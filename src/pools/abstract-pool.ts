import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type { MessageValue, PromiseResponseWrapper } from '../utility-types'
import {
  DEFAULT_TASK_NAME,
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS,
  EMPTY_FUNCTION,
  isKillBehavior,
  isPlainObject,
  median,
  round
} from '../utils'
import { KillBehaviors } from '../worker/worker-options'
import {
  type IPool,
  PoolEmitter,
  PoolEvents,
  type PoolInfo,
  type PoolOptions,
  type PoolType,
  PoolTypes,
  type TasksQueueOptions
} from './pool'
import type {
  IWorker,
  IWorkerNode,
  MessageHandler,
  Task,
  WorkerInfo,
  WorkerType,
  WorkerUsage
} from './worker'
import {
  Measurements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions
} from './selection-strategies/selection-strategies-types'
import { WorkerChoiceStrategyContext } from './selection-strategies/worker-choice-strategy-context'
import { version } from './version'
import { WorkerNode } from './worker-node'

/**
 * Base class that implements some shared logic for all poolifier pools.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export abstract class AbstractPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IPool<Worker, Data, Response> {
  /** @inheritDoc */
  public readonly workerNodes: Array<IWorkerNode<Worker, Data>> = []

  /** @inheritDoc */
  public readonly emitter?: PoolEmitter

  /**
   * The execution response promise map.
   *
   * - `key`: The message id of each submitted task.
   * - `value`: An object that contains the worker, the execution response promise resolve and reject callbacks.
   *
   * When we receive a message from the worker, we get a map entry with the promise resolve/reject bound to the message id.
   */
  protected promiseResponseMap: Map<
  string,
  PromiseResponseWrapper<Worker, Response>
  > = new Map<string, PromiseResponseWrapper<Worker, Response>>()

  /**
   * Worker choice strategy context referencing a worker choice algorithm implementation.
   */
  protected workerChoiceStrategyContext: WorkerChoiceStrategyContext<
  Worker,
  Data,
  Response
  >

  /**
   * The start timestamp of the pool.
   */
  private readonly startTimestamp

  /**
   * Constructs a new poolifier pool.
   *
   * @param numberOfWorkers - Number of workers that this pool should manage.
   * @param filePath - Path to the worker file.
   * @param opts - Options for the pool.
   */
  public constructor (
    protected readonly numberOfWorkers: number,
    protected readonly filePath: string,
    protected readonly opts: PoolOptions<Worker>
  ) {
    if (!this.isMain()) {
      throw new Error('Cannot start a pool from a worker!')
    }
    this.checkNumberOfWorkers(this.numberOfWorkers)
    this.checkFilePath(this.filePath)
    this.checkPoolOptions(this.opts)

    this.chooseWorkerNode = this.chooseWorkerNode.bind(this)
    this.executeTask = this.executeTask.bind(this)
    this.enqueueTask = this.enqueueTask.bind(this)
    this.checkAndEmitEvents = this.checkAndEmitEvents.bind(this)

    if (this.opts.enableEvents === true) {
      this.emitter = new PoolEmitter()
    }
    this.workerChoiceStrategyContext = new WorkerChoiceStrategyContext<
    Worker,
    Data,
    Response
    >(
      this,
      this.opts.workerChoiceStrategy,
      this.opts.workerChoiceStrategyOptions
    )

    this.setupHook()

    while (this.workerNodes.length < this.numberOfWorkers) {
      this.createAndSetupWorker()
    }

    this.startTimestamp = performance.now()
  }

  private checkFilePath (filePath: string): void {
    if (
      filePath == null ||
      (typeof filePath === 'string' && filePath.trim().length === 0)
    ) {
      throw new Error('Please specify a file with a worker implementation')
    }
  }

  private checkNumberOfWorkers (numberOfWorkers: number): void {
    if (numberOfWorkers == null) {
      throw new Error(
        'Cannot instantiate a pool without specifying the number of workers'
      )
    } else if (!Number.isSafeInteger(numberOfWorkers)) {
      throw new TypeError(
        'Cannot instantiate a pool with a non safe integer number of workers'
      )
    } else if (numberOfWorkers < 0) {
      throw new RangeError(
        'Cannot instantiate a pool with a negative number of workers'
      )
    } else if (this.type === PoolTypes.fixed && numberOfWorkers === 0) {
      throw new RangeError('Cannot instantiate a fixed pool with zero worker')
    }
  }

  protected checkDynamicPoolSize (min: number, max: number): void {
    if (this.type === PoolTypes.dynamic) {
      if (min > max) {
        throw new RangeError(
          'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size'
        )
      } else if (min === 0 && max === 0) {
        throw new RangeError(
          'Cannot instantiate a dynamic pool with a minimum pool size and a maximum pool size equal to zero'
        )
      } else if (min === max) {
        throw new RangeError(
          'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead'
        )
      }
    }
  }

  private checkPoolOptions (opts: PoolOptions<Worker>): void {
    if (isPlainObject(opts)) {
      this.opts.workerChoiceStrategy =
        opts.workerChoiceStrategy ?? WorkerChoiceStrategies.ROUND_ROBIN
      this.checkValidWorkerChoiceStrategy(this.opts.workerChoiceStrategy)
      this.opts.workerChoiceStrategyOptions =
        opts.workerChoiceStrategyOptions ??
        DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
      this.checkValidWorkerChoiceStrategyOptions(
        this.opts.workerChoiceStrategyOptions
      )
      this.opts.restartWorkerOnError = opts.restartWorkerOnError ?? true
      this.opts.enableEvents = opts.enableEvents ?? true
      this.opts.enableTasksQueue = opts.enableTasksQueue ?? false
      if (this.opts.enableTasksQueue) {
        this.checkValidTasksQueueOptions(
          opts.tasksQueueOptions as TasksQueueOptions
        )
        this.opts.tasksQueueOptions = this.buildTasksQueueOptions(
          opts.tasksQueueOptions as TasksQueueOptions
        )
      }
    } else {
      throw new TypeError('Invalid pool options: must be a plain object')
    }
  }

  private checkValidWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    if (!Object.values(WorkerChoiceStrategies).includes(workerChoiceStrategy)) {
      throw new Error(
        `Invalid worker choice strategy '${workerChoiceStrategy}'`
      )
    }
  }

  private checkValidWorkerChoiceStrategyOptions (
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions
  ): void {
    if (!isPlainObject(workerChoiceStrategyOptions)) {
      throw new TypeError(
        'Invalid worker choice strategy options: must be a plain object'
      )
    }
    if (
      workerChoiceStrategyOptions.weights != null &&
      Object.keys(workerChoiceStrategyOptions.weights).length !== this.maxSize
    ) {
      throw new Error(
        'Invalid worker choice strategy options: must have a weight for each worker node'
      )
    }
    if (
      workerChoiceStrategyOptions.measurement != null &&
      !Object.values(Measurements).includes(
        workerChoiceStrategyOptions.measurement
      )
    ) {
      throw new Error(
        `Invalid worker choice strategy options: invalid measurement '${workerChoiceStrategyOptions.measurement}'`
      )
    }
  }

  private checkValidTasksQueueOptions (
    tasksQueueOptions: TasksQueueOptions
  ): void {
    if (tasksQueueOptions != null && !isPlainObject(tasksQueueOptions)) {
      throw new TypeError('Invalid tasks queue options: must be a plain object')
    }
    if (
      tasksQueueOptions?.concurrency != null &&
      !Number.isSafeInteger(tasksQueueOptions.concurrency)
    ) {
      throw new TypeError(
        'Invalid worker tasks concurrency: must be an integer'
      )
    }
    if (
      tasksQueueOptions?.concurrency != null &&
      tasksQueueOptions.concurrency <= 0
    ) {
      throw new Error(
        `Invalid worker tasks concurrency '${tasksQueueOptions.concurrency}'`
      )
    }
  }

  /** @inheritDoc */
  public get info (): PoolInfo {
    return {
      version,
      type: this.type,
      worker: this.worker,
      ready: this.ready,
      strategy: this.opts.workerChoiceStrategy as WorkerChoiceStrategy,
      minSize: this.minSize,
      maxSize: this.maxSize,
      ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
        .runTime.aggregate &&
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
          .waitTime.aggregate && { utilization: round(this.utilization) }),
      workerNodes: this.workerNodes.length,
      idleWorkerNodes: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          workerNode.usage.tasks.executing === 0
            ? accumulator + 1
            : accumulator,
        0
      ),
      busyWorkerNodes: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          workerNode.usage.tasks.executing > 0 ? accumulator + 1 : accumulator,
        0
      ),
      executedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.executed,
        0
      ),
      executingTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.executing,
        0
      ),
      queuedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.queued,
        0
      ),
      maxQueuedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + (workerNode.usage.tasks?.maxQueued ?? 0),
        0
      ),
      failedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.failed,
        0
      ),
      ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
        .runTime.aggregate && {
        runTime: {
          minimum: round(
            Math.min(
              ...this.workerNodes.map(
                workerNode => workerNode.usage.runTime?.minimum ?? Infinity
              )
            )
          ),
          maximum: round(
            Math.max(
              ...this.workerNodes.map(
                workerNode => workerNode.usage.runTime?.maximum ?? -Infinity
              )
            )
          ),
          average: round(
            this.workerNodes.reduce(
              (accumulator, workerNode) =>
                accumulator + (workerNode.usage.runTime?.aggregate ?? 0),
              0
            ) /
              this.workerNodes.reduce(
                (accumulator, workerNode) =>
                  accumulator + (workerNode.usage.tasks?.executed ?? 0),
                0
              )
          ),
          ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
            .runTime.median && {
            median: round(
              median(
                this.workerNodes.map(
                  workerNode => workerNode.usage.runTime?.median ?? 0
                )
              )
            )
          })
        }
      }),
      ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
        .waitTime.aggregate && {
        waitTime: {
          minimum: round(
            Math.min(
              ...this.workerNodes.map(
                workerNode => workerNode.usage.waitTime?.minimum ?? Infinity
              )
            )
          ),
          maximum: round(
            Math.max(
              ...this.workerNodes.map(
                workerNode => workerNode.usage.waitTime?.maximum ?? -Infinity
              )
            )
          ),
          average: round(
            this.workerNodes.reduce(
              (accumulator, workerNode) =>
                accumulator + (workerNode.usage.waitTime?.aggregate ?? 0),
              0
            ) /
              this.workerNodes.reduce(
                (accumulator, workerNode) =>
                  accumulator + (workerNode.usage.tasks?.executed ?? 0),
                0
              )
          ),
          ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
            .waitTime.median && {
            median: round(
              median(
                this.workerNodes.map(
                  workerNode => workerNode.usage.waitTime?.median ?? 0
                )
              )
            )
          })
        }
      })
    }
  }

  private get starting (): boolean {
    return (
      this.workerNodes.length < this.minSize ||
      (this.workerNodes.length >= this.minSize &&
        this.workerNodes.some(workerNode => !workerNode.info.ready))
    )
  }

  private get ready (): boolean {
    return (
      this.workerNodes.length >= this.minSize &&
      this.workerNodes.every(workerNode => workerNode.info.ready)
    )
  }

  /**
   * Gets the approximate pool utilization.
   *
   * @returns The pool utilization.
   */
  private get utilization (): number {
    const poolRunTimeCapacity =
      (performance.now() - this.startTimestamp) * this.maxSize
    const totalTasksRunTime = this.workerNodes.reduce(
      (accumulator, workerNode) =>
        accumulator + (workerNode.usage.runTime?.aggregate ?? 0),
      0
    )
    const totalTasksWaitTime = this.workerNodes.reduce(
      (accumulator, workerNode) =>
        accumulator + (workerNode.usage.waitTime?.aggregate ?? 0),
      0
    )
    return (totalTasksRunTime + totalTasksWaitTime) / poolRunTimeCapacity
  }

  /**
   * Pool type.
   *
   * If it is `'dynamic'`, it provides the `max` property.
   */
  protected abstract get type (): PoolType

  /**
   * Gets the worker type.
   */
  protected abstract get worker (): WorkerType

  /**
   * Pool minimum size.
   */
  protected abstract get minSize (): number

  /**
   * Pool maximum size.
   */
  protected abstract get maxSize (): number

  /**
   * Get the worker given its id.
   *
   * @param workerId - The worker id.
   * @returns The worker if found in the pool worker nodes, `undefined` otherwise.
   */
  private getWorkerById (workerId: number): Worker | undefined {
    return this.workerNodes.find(workerNode => workerNode.info.id === workerId)
      ?.worker
  }

  private checkMessageWorkerId (message: MessageValue<Response>): void {
    if (
      message.workerId != null &&
      this.getWorkerById(message.workerId) == null
    ) {
      throw new Error(
        `Worker message received from unknown worker '${message.workerId}'`
      )
    }
  }

  /**
   * Gets the given worker its worker node key.
   *
   * @param worker - The worker.
   * @returns The worker node key if found in the pool worker nodes, `-1` otherwise.
   */
  private getWorkerNodeKey (worker: Worker): number {
    return this.workerNodes.findIndex(
      workerNode => workerNode.worker === worker
    )
  }

  /** @inheritDoc */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy,
    workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  ): void {
    this.checkValidWorkerChoiceStrategy(workerChoiceStrategy)
    this.opts.workerChoiceStrategy = workerChoiceStrategy
    this.workerChoiceStrategyContext.setWorkerChoiceStrategy(
      this.opts.workerChoiceStrategy
    )
    if (workerChoiceStrategyOptions != null) {
      this.setWorkerChoiceStrategyOptions(workerChoiceStrategyOptions)
    }
    for (const workerNode of this.workerNodes) {
      workerNode.resetUsage()
      this.setWorkerStatistics(workerNode.worker)
    }
  }

  /** @inheritDoc */
  public setWorkerChoiceStrategyOptions (
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions
  ): void {
    this.checkValidWorkerChoiceStrategyOptions(workerChoiceStrategyOptions)
    this.opts.workerChoiceStrategyOptions = workerChoiceStrategyOptions
    this.workerChoiceStrategyContext.setOptions(
      this.opts.workerChoiceStrategyOptions
    )
  }

  /** @inheritDoc */
  public enableTasksQueue (
    enable: boolean,
    tasksQueueOptions?: TasksQueueOptions
  ): void {
    if (this.opts.enableTasksQueue === true && !enable) {
      this.flushTasksQueues()
    }
    this.opts.enableTasksQueue = enable
    this.setTasksQueueOptions(tasksQueueOptions as TasksQueueOptions)
  }

  /** @inheritDoc */
  public setTasksQueueOptions (tasksQueueOptions: TasksQueueOptions): void {
    if (this.opts.enableTasksQueue === true) {
      this.checkValidTasksQueueOptions(tasksQueueOptions)
      this.opts.tasksQueueOptions =
        this.buildTasksQueueOptions(tasksQueueOptions)
    } else if (this.opts.tasksQueueOptions != null) {
      delete this.opts.tasksQueueOptions
    }
  }

  private buildTasksQueueOptions (
    tasksQueueOptions: TasksQueueOptions
  ): TasksQueueOptions {
    return {
      concurrency: tasksQueueOptions?.concurrency ?? 1
    }
  }

  /**
   * Whether the pool is full or not.
   *
   * The pool filling boolean status.
   */
  protected get full (): boolean {
    return this.workerNodes.length >= this.maxSize
  }

  /**
   * Whether the pool is busy or not.
   *
   * The pool busyness boolean status.
   */
  protected abstract get busy (): boolean

  /**
   * Whether worker nodes are executing at least one task.
   *
   * @returns Worker nodes busyness boolean status.
   */
  protected internalBusy (): boolean {
    return (
      this.workerNodes.findIndex(workerNode => {
        return workerNode.usage.tasks.executing === 0
      }) === -1
    )
  }

  /** @inheritDoc */
  public async execute (data?: Data, name?: string): Promise<Response> {
    const timestamp = performance.now()
    const workerNodeKey = this.chooseWorkerNode()
    const submittedTask: Task<Data> = {
      name: name ?? DEFAULT_TASK_NAME,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      data: data ?? ({} as Data),
      timestamp,
      workerId: this.getWorkerInfo(workerNodeKey).id as number,
      id: randomUUID()
    }
    const res = new Promise<Response>((resolve, reject) => {
      this.promiseResponseMap.set(submittedTask.id as string, {
        resolve,
        reject,
        worker: this.workerNodes[workerNodeKey].worker
      })
    })
    if (
      this.opts.enableTasksQueue === true &&
      (this.busy ||
        this.workerNodes[workerNodeKey].usage.tasks.executing >=
          ((this.opts.tasksQueueOptions as TasksQueueOptions)
            .concurrency as number))
    ) {
      this.enqueueTask(workerNodeKey, submittedTask)
    } else {
      this.executeTask(workerNodeKey, submittedTask)
    }
    this.checkAndEmitEvents()
    // eslint-disable-next-line @typescript-eslint/return-await
    return res
  }

  /** @inheritDoc */
  public async destroy (): Promise<void> {
    await Promise.all(
      this.workerNodes.map(async (workerNode, workerNodeKey) => {
        this.flushTasksQueue(workerNodeKey)
        // FIXME: wait for tasks to be finished
        const workerExitPromise = new Promise<void>(resolve => {
          workerNode.worker.on('exit', () => {
            resolve()
          })
        })
        await this.destroyWorker(workerNode.worker)
        await workerExitPromise
      })
    )
  }

  /**
   * Terminates the given worker.
   *
   * @param worker - A worker within `workerNodes`.
   */
  protected abstract destroyWorker (worker: Worker): void | Promise<void>

  /**
   * Setup hook to execute code before worker nodes are created in the abstract constructor.
   * Can be overridden.
   *
   * @virtual
   */
  protected setupHook (): void {
    // Intentionally empty
  }

  /**
   * Should return whether the worker is the main worker or not.
   */
  protected abstract isMain (): boolean

  /**
   * Hook executed before the worker task execution.
   * Can be overridden.
   *
   * @param workerNodeKey - The worker node key.
   * @param task - The task to execute.
   */
  protected beforeTaskExecutionHook (
    workerNodeKey: number,
    task: Task<Data>
  ): void {
    const workerUsage = this.workerNodes[workerNodeKey].usage
    ++workerUsage.tasks.executing
    this.updateWaitTimeWorkerUsage(workerUsage, task)
    const tasksWorkerUsage = this.workerNodes[
      workerNodeKey
    ].getTasksWorkerUsage(task.name as string) as WorkerUsage
    ++tasksWorkerUsage.tasks.executing
    this.updateWaitTimeWorkerUsage(tasksWorkerUsage, task)
  }

  /**
   * Hook executed after the worker task execution.
   * Can be overridden.
   *
   * @param worker - The worker.
   * @param message - The received message.
   */
  protected afterTaskExecutionHook (
    worker: Worker,
    message: MessageValue<Response>
  ): void {
    const workerNodeKey = this.getWorkerNodeKey(worker)
    const workerUsage = this.workerNodes[workerNodeKey].usage
    this.updateTaskStatisticsWorkerUsage(workerUsage, message)
    this.updateRunTimeWorkerUsage(workerUsage, message)
    this.updateEluWorkerUsage(workerUsage, message)
    const tasksWorkerUsage = this.workerNodes[
      workerNodeKey
    ].getTasksWorkerUsage(message.name as string) as WorkerUsage
    this.updateTaskStatisticsWorkerUsage(tasksWorkerUsage, message)
    this.updateRunTimeWorkerUsage(tasksWorkerUsage, message)
    this.updateEluWorkerUsage(tasksWorkerUsage, message)
  }

  private updateTaskStatisticsWorkerUsage (
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void {
    const workerTaskStatistics = workerUsage.tasks
    --workerTaskStatistics.executing
    if (message.taskError == null) {
      ++workerTaskStatistics.executed
    } else {
      ++workerTaskStatistics.failed
    }
  }

  private updateRunTimeWorkerUsage (
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void {
    if (
      this.workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
        .aggregate
    ) {
      const taskRunTime = message.taskPerformance?.runTime ?? 0
      workerUsage.runTime.aggregate =
        (workerUsage.runTime.aggregate ?? 0) + taskRunTime
      workerUsage.runTime.minimum = Math.min(
        taskRunTime,
        workerUsage.runTime?.minimum ?? Infinity
      )
      workerUsage.runTime.maximum = Math.max(
        taskRunTime,
        workerUsage.runTime?.maximum ?? -Infinity
      )
      if (
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .average &&
        workerUsage.tasks.executed !== 0
      ) {
        workerUsage.runTime.average =
          workerUsage.runTime.aggregate / workerUsage.tasks.executed
      }
      if (
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .median &&
        message.taskPerformance?.runTime != null
      ) {
        workerUsage.runTime.history.push(message.taskPerformance.runTime)
        workerUsage.runTime.median = median(workerUsage.runTime.history)
      }
    }
  }

  private updateWaitTimeWorkerUsage (
    workerUsage: WorkerUsage,
    task: Task<Data>
  ): void {
    const timestamp = performance.now()
    const taskWaitTime = timestamp - (task.timestamp ?? timestamp)
    if (
      this.workerChoiceStrategyContext.getTaskStatisticsRequirements().waitTime
        .aggregate
    ) {
      workerUsage.waitTime.aggregate =
        (workerUsage.waitTime?.aggregate ?? 0) + taskWaitTime
      workerUsage.waitTime.minimum = Math.min(
        taskWaitTime,
        workerUsage.waitTime?.minimum ?? Infinity
      )
      workerUsage.waitTime.maximum = Math.max(
        taskWaitTime,
        workerUsage.waitTime?.maximum ?? -Infinity
      )
      if (
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
          .waitTime.average &&
        workerUsage.tasks.executed !== 0
      ) {
        workerUsage.waitTime.average =
          workerUsage.waitTime.aggregate / workerUsage.tasks.executed
      }
      if (
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
          .waitTime.median
      ) {
        workerUsage.waitTime.history.push(taskWaitTime)
        workerUsage.waitTime.median = median(workerUsage.waitTime.history)
      }
    }
  }

  private updateEluWorkerUsage (
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void {
    if (
      this.workerChoiceStrategyContext.getTaskStatisticsRequirements().elu
        .aggregate
    ) {
      if (message.taskPerformance?.elu != null) {
        workerUsage.elu.idle.aggregate =
          (workerUsage.elu.idle?.aggregate ?? 0) +
          message.taskPerformance.elu.idle
        workerUsage.elu.active.aggregate =
          (workerUsage.elu.active?.aggregate ?? 0) +
          message.taskPerformance.elu.active
        if (workerUsage.elu.utilization != null) {
          workerUsage.elu.utilization =
            (workerUsage.elu.utilization +
              message.taskPerformance.elu.utilization) /
            2
        } else {
          workerUsage.elu.utilization = message.taskPerformance.elu.utilization
        }
        workerUsage.elu.idle.minimum = Math.min(
          message.taskPerformance.elu.idle,
          workerUsage.elu.idle?.minimum ?? Infinity
        )
        workerUsage.elu.idle.maximum = Math.max(
          message.taskPerformance.elu.idle,
          workerUsage.elu.idle?.maximum ?? -Infinity
        )
        workerUsage.elu.active.minimum = Math.min(
          message.taskPerformance.elu.active,
          workerUsage.elu.active?.minimum ?? Infinity
        )
        workerUsage.elu.active.maximum = Math.max(
          message.taskPerformance.elu.active,
          workerUsage.elu.active?.maximum ?? -Infinity
        )
        if (
          this.workerChoiceStrategyContext.getTaskStatisticsRequirements().elu
            .average &&
          workerUsage.tasks.executed !== 0
        ) {
          workerUsage.elu.idle.average =
            workerUsage.elu.idle.aggregate / workerUsage.tasks.executed
          workerUsage.elu.active.average =
            workerUsage.elu.active.aggregate / workerUsage.tasks.executed
        }
        if (
          this.workerChoiceStrategyContext.getTaskStatisticsRequirements().elu
            .median
        ) {
          workerUsage.elu.idle.history.push(message.taskPerformance.elu.idle)
          workerUsage.elu.active.history.push(
            message.taskPerformance.elu.active
          )
          workerUsage.elu.idle.median = median(workerUsage.elu.idle.history)
          workerUsage.elu.active.median = median(workerUsage.elu.active.history)
        }
      }
    }
  }

  /**
   * Chooses a worker node for the next task.
   *
   * The default worker choice strategy uses a round robin algorithm to distribute the tasks.
   *
   * @returns The worker node key
   */
  private chooseWorkerNode (): number {
    if (this.shallCreateDynamicWorker()) {
      const worker = this.createAndSetupDynamicWorker()
      if (
        this.workerChoiceStrategyContext.getStrategyPolicy().useDynamicWorker
      ) {
        return this.getWorkerNodeKey(worker)
      }
    }
    return this.workerChoiceStrategyContext.execute()
  }

  /**
   * Conditions for dynamic worker creation.
   *
   * @returns Whether to create a dynamic worker or not.
   */
  private shallCreateDynamicWorker (): boolean {
    return this.type === PoolTypes.dynamic && !this.full && this.internalBusy()
  }

  /**
   * Sends a message to the given worker.
   *
   * @param worker - The worker which should receive the message.
   * @param message - The message.
   */
  protected abstract sendToWorker (
    worker: Worker,
    message: MessageValue<Data>
  ): void

  /**
   * Registers a listener callback on the given worker.
   *
   * @param worker - The worker which should register a listener.
   * @param listener - The message listener callback.
   */
  private registerWorkerMessageListener<Message extends Data | Response>(
    worker: Worker,
    listener: (message: MessageValue<Message>) => void
  ): void {
    worker.on('message', listener as MessageHandler<Worker>)
  }

  /**
   * Creates a new worker.
   *
   * @returns Newly created worker.
   */
  protected abstract createWorker (): Worker

  /**
   * Function that can be hooked up when a worker has been newly created and moved to the pool worker nodes.
   * Can be overridden.
   *
   * @param worker - The newly created worker.
   */
  protected afterWorkerSetup (worker: Worker): void {
    // Listen to worker messages.
    this.registerWorkerMessageListener(worker, this.workerListener())
    // Send startup message to worker.
    this.sendToWorker(worker, {
      ready: false,
      workerId: this.getWorkerInfo(this.getWorkerNodeKey(worker)).id as number
    })
    // Setup worker task statistics computation.
    this.setWorkerStatistics(worker)
  }

  /**
   * Creates a new worker and sets it up completely in the pool worker nodes.
   *
   * @returns New, completely set up worker.
   */
  protected createAndSetupWorker (): Worker {
    const worker = this.createWorker()

    worker.on('message', this.opts.messageHandler ?? EMPTY_FUNCTION)
    worker.on('error', this.opts.errorHandler ?? EMPTY_FUNCTION)
    worker.on('error', error => {
      if (this.emitter != null) {
        this.emitter.emit(PoolEvents.error, error)
      }
      if (this.opts.enableTasksQueue === true) {
        this.redistributeQueuedTasks(worker)
      }
      if (this.opts.restartWorkerOnError === true && !this.starting) {
        if (this.getWorkerInfo(this.getWorkerNodeKey(worker)).dynamic) {
          this.createAndSetupDynamicWorker()
        } else {
          this.createAndSetupWorker()
        }
      }
    })
    worker.on('online', this.opts.onlineHandler ?? EMPTY_FUNCTION)
    worker.on('exit', this.opts.exitHandler ?? EMPTY_FUNCTION)
    worker.once('exit', () => {
      this.removeWorkerNode(worker)
    })

    this.pushWorkerNode(worker)

    this.afterWorkerSetup(worker)

    return worker
  }

  private redistributeQueuedTasks (worker: Worker): void {
    const workerNodeKey = this.getWorkerNodeKey(worker)
    while (this.tasksQueueSize(workerNodeKey) > 0) {
      let targetWorkerNodeKey: number = workerNodeKey
      let minQueuedTasks = Infinity
      for (const [workerNodeId, workerNode] of this.workerNodes.entries()) {
        if (
          workerNodeId !== workerNodeKey &&
          workerNode.usage.tasks.queued === 0
        ) {
          targetWorkerNodeKey = workerNodeId
          break
        }
        if (
          workerNodeId !== workerNodeKey &&
          workerNode.usage.tasks.queued < minQueuedTasks
        ) {
          minQueuedTasks = workerNode.usage.tasks.queued
          targetWorkerNodeKey = workerNodeId
        }
      }
      this.enqueueTask(
        targetWorkerNodeKey,
        this.dequeueTask(workerNodeKey) as Task<Data>
      )
    }
  }

  /**
   * Creates a new dynamic worker and sets it up completely in the pool worker nodes.
   *
   * @returns New, completely set up dynamic worker.
   */
  protected createAndSetupDynamicWorker (): Worker {
    const worker = this.createAndSetupWorker()
    this.registerWorkerMessageListener(worker, message => {
      const workerNodeKey = this.getWorkerNodeKey(worker)
      if (
        isKillBehavior(KillBehaviors.HARD, message.kill) ||
        (message.kill != null &&
          ((this.opts.enableTasksQueue === false &&
            this.workerNodes[workerNodeKey].usage.tasks.executing === 0) ||
            (this.opts.enableTasksQueue === true &&
              this.workerNodes[workerNodeKey].usage.tasks.executing === 0 &&
              this.tasksQueueSize(workerNodeKey) === 0)))
      ) {
        // Kill message received from the worker: no new tasks are submitted to that worker for a while ( > maxInactiveTime)
        void (this.destroyWorker(worker) as Promise<void>)
      }
    })
    const workerInfo = this.getWorkerInfo(this.getWorkerNodeKey(worker))
    workerInfo.dynamic = true
    this.sendToWorker(worker, {
      checkAlive: true,
      workerId: workerInfo.id as number
    })
    return worker
  }

  /**
   * This function is the listener registered for each worker message.
   *
   * @returns The listener function to execute when a message is received from a worker.
   */
  protected workerListener (): (message: MessageValue<Response>) => void {
    return message => {
      this.checkMessageWorkerId(message)
      if (message.ready != null && message.workerId != null) {
        // Worker ready message received
        this.handleWorkerReadyMessage(message)
      } else if (message.id != null) {
        // Task execution response received
        this.handleTaskExecutionResponse(message)
      }
    }
  }

  private handleWorkerReadyMessage (message: MessageValue<Response>): void {
    const worker = this.getWorkerById(message.workerId)
    this.getWorkerInfo(this.getWorkerNodeKey(worker as Worker)).ready =
      message.ready as boolean
    if (this.emitter != null && this.ready) {
      this.emitter.emit(PoolEvents.ready, this.info)
    }
  }

  private handleTaskExecutionResponse (message: MessageValue<Response>): void {
    const promiseResponse = this.promiseResponseMap.get(message.id as string)
    if (promiseResponse != null) {
      if (message.taskError != null) {
        if (this.emitter != null) {
          this.emitter.emit(PoolEvents.taskError, message.taskError)
        }
        promiseResponse.reject(message.taskError.message)
      } else {
        promiseResponse.resolve(message.data as Response)
      }
      this.afterTaskExecutionHook(promiseResponse.worker, message)
      this.promiseResponseMap.delete(message.id as string)
      const workerNodeKey = this.getWorkerNodeKey(promiseResponse.worker)
      if (
        this.opts.enableTasksQueue === true &&
        this.tasksQueueSize(workerNodeKey) > 0
      ) {
        this.executeTask(
          workerNodeKey,
          this.dequeueTask(workerNodeKey) as Task<Data>
        )
      }
      this.workerChoiceStrategyContext.update(workerNodeKey)
    }
  }

  private checkAndEmitEvents (): void {
    if (this.emitter != null) {
      if (this.busy) {
        this.emitter.emit(PoolEvents.busy, this.info)
      }
      if (this.type === PoolTypes.dynamic && this.full) {
        this.emitter.emit(PoolEvents.full, this.info)
      }
    }
  }

  /**
   * Gets the worker information.
   *
   * @param workerNodeKey - The worker node key.
   */
  private getWorkerInfo (workerNodeKey: number): WorkerInfo {
    return this.workerNodes[workerNodeKey].info
  }

  /**
   * Pushes the given worker in the pool worker nodes.
   *
   * @param worker - The worker.
   * @returns The worker nodes length.
   */
  private pushWorkerNode (worker: Worker): number {
    return this.workerNodes.push(new WorkerNode(worker, this.worker))
  }

  /**
   * Removes the given worker from the pool worker nodes.
   *
   * @param worker - The worker.
   */
  private removeWorkerNode (worker: Worker): void {
    const workerNodeKey = this.getWorkerNodeKey(worker)
    if (workerNodeKey !== -1) {
      this.workerNodes.splice(workerNodeKey, 1)
      this.workerChoiceStrategyContext.remove(workerNodeKey)
    }
  }

  private executeTask (workerNodeKey: number, task: Task<Data>): void {
    this.beforeTaskExecutionHook(workerNodeKey, task)
    this.sendToWorker(this.workerNodes[workerNodeKey].worker, task)
  }

  private enqueueTask (workerNodeKey: number, task: Task<Data>): number {
    return this.workerNodes[workerNodeKey].enqueueTask(task)
  }

  private dequeueTask (workerNodeKey: number): Task<Data> | undefined {
    return this.workerNodes[workerNodeKey].dequeueTask()
  }

  private tasksQueueSize (workerNodeKey: number): number {
    return this.workerNodes[workerNodeKey].tasksQueueSize()
  }

  private flushTasksQueue (workerNodeKey: number): void {
    while (this.tasksQueueSize(workerNodeKey) > 0) {
      this.executeTask(
        workerNodeKey,
        this.dequeueTask(workerNodeKey) as Task<Data>
      )
    }
    this.workerNodes[workerNodeKey].clearTasksQueue()
  }

  private flushTasksQueues (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      this.flushTasksQueue(workerNodeKey)
    }
  }

  private setWorkerStatistics (worker: Worker): void {
    this.sendToWorker(worker, {
      statistics: {
        runTime:
          this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
            .runTime.aggregate,
        elu: this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
          .elu.aggregate
      },
      workerId: this.getWorkerInfo(this.getWorkerNodeKey(worker)).id as number
    })
  }
}
