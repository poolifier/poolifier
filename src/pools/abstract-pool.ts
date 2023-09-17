import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { existsSync } from 'node:fs'
import { type TransferListItem } from 'node:worker_threads'
import type {
  MessageValue,
  PromiseResponseWrapper,
  Task
} from '../utility-types'
import {
  DEFAULT_TASK_NAME,
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS,
  EMPTY_FUNCTION,
  average,
  isKillBehavior,
  isPlainObject,
  max,
  median,
  min,
  round,
  updateMeasurementStatistics
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
  WorkerInfo,
  WorkerType,
  WorkerUsage
} from './worker'
import {
  type MeasurementStatisticsRequirements,
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
   * The task execution response promise map:
   * - `key`: The message id of each submitted task.
   * - `value`: An object that contains the worker, the execution response promise resolve and reject callbacks.
   *
   * When we receive a message from the worker, we get a map entry with the promise resolve/reject bound to the message id.
   */
  protected promiseResponseMap: Map<string, PromiseResponseWrapper<Response>> =
    new Map<string, PromiseResponseWrapper<Response>>()

  /**
   * Worker choice strategy context referencing a worker choice algorithm implementation.
   */
  protected workerChoiceStrategyContext: WorkerChoiceStrategyContext<
  Worker,
  Data,
  Response
  >

  /**
   * Dynamic pool maximum size property placeholder.
   */
  protected readonly max?: number

  /**
   * Whether the pool is started or not.
   */
  private started: boolean
  /**
   * Whether the pool is starting or not.
   */
  private starting: boolean
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
      throw new Error(
        'Cannot start a pool from a worker with the same type as the pool'
      )
    }
    this.checkNumberOfWorkers(this.numberOfWorkers)
    this.checkFilePath(this.filePath)
    this.checkPoolOptions(this.opts)

    this.chooseWorkerNode = this.chooseWorkerNode.bind(this)
    this.executeTask = this.executeTask.bind(this)
    this.enqueueTask = this.enqueueTask.bind(this)

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

    this.started = false
    this.starting = false
    if (this.opts.startWorkers === true) {
      this.start()
    }

    this.startTimestamp = performance.now()
  }

  private checkFilePath (filePath: string): void {
    if (
      filePath == null ||
      typeof filePath !== 'string' ||
      (typeof filePath === 'string' && filePath.trim().length === 0)
    ) {
      throw new Error('Please specify a file with a worker implementation')
    }
    if (!existsSync(filePath)) {
      throw new Error(`Cannot find the worker file '${filePath}'`)
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
      if (max == null) {
        throw new TypeError(
          'Cannot instantiate a dynamic pool without specifying the maximum pool size'
        )
      } else if (!Number.isSafeInteger(max)) {
        throw new TypeError(
          'Cannot instantiate a dynamic pool with a non safe integer maximum pool size'
        )
      } else if (min > max) {
        throw new RangeError(
          'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size'
        )
      } else if (max === 0) {
        throw new RangeError(
          'Cannot instantiate a dynamic pool with a maximum pool size equal to zero'
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
      this.opts.startWorkers = opts.startWorkers ?? true
      this.opts.workerChoiceStrategy =
        opts.workerChoiceStrategy ?? WorkerChoiceStrategies.ROUND_ROBIN
      this.checkValidWorkerChoiceStrategy(this.opts.workerChoiceStrategy)
      this.opts.workerChoiceStrategyOptions = {
        ...DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS,
        ...opts.workerChoiceStrategyOptions
      }
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
      workerChoiceStrategyOptions.retries != null &&
      !Number.isSafeInteger(workerChoiceStrategyOptions.retries)
    ) {
      throw new TypeError(
        'Invalid worker choice strategy options: retries must be an integer'
      )
    }
    if (
      workerChoiceStrategyOptions.retries != null &&
      workerChoiceStrategyOptions.retries < 0
    ) {
      throw new RangeError(
        `Invalid worker choice strategy options: retries '${workerChoiceStrategyOptions.retries}' must be greater or equal than zero`
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
      !Number.isSafeInteger(tasksQueueOptions?.concurrency)
    ) {
      throw new TypeError(
        'Invalid worker node tasks concurrency: must be an integer'
      )
    }
    if (
      tasksQueueOptions?.concurrency != null &&
      tasksQueueOptions?.concurrency <= 0
    ) {
      throw new RangeError(
        `Invalid worker node tasks concurrency: ${tasksQueueOptions?.concurrency} is a negative integer or zero`
      )
    }
    if (
      tasksQueueOptions?.size != null &&
      !Number.isSafeInteger(tasksQueueOptions?.size)
    ) {
      throw new TypeError(
        'Invalid worker node tasks queue size: must be an integer'
      )
    }
    if (tasksQueueOptions?.size != null && tasksQueueOptions?.size <= 0) {
      throw new RangeError(
        `Invalid worker node tasks queue size: ${tasksQueueOptions?.size} is a negative integer or zero`
      )
    }
  }

  /** @inheritDoc */
  public get info (): PoolInfo {
    return {
      version,
      type: this.type,
      worker: this.worker,
      started: this.started,
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
      ...(this.opts.enableTasksQueue === true && {
        queuedTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + workerNode.usage.tasks.queued,
          0
        )
      }),
      ...(this.opts.enableTasksQueue === true && {
        maxQueuedTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + (workerNode.usage.tasks?.maxQueued ?? 0),
          0
        )
      }),
      ...(this.opts.enableTasksQueue === true && {
        backPressure: this.hasBackPressure()
      }),
      ...(this.opts.enableTasksQueue === true && {
        stolenTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + workerNode.usage.tasks.stolen,
          0
        )
      }),
      failedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.failed,
        0
      ),
      ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
        .runTime.aggregate && {
        runTime: {
          minimum: round(
            min(
              ...this.workerNodes.map(
                workerNode => workerNode.usage.runTime?.minimum ?? Infinity
              )
            )
          ),
          maximum: round(
            max(
              ...this.workerNodes.map(
                workerNode => workerNode.usage.runTime?.maximum ?? -Infinity
              )
            )
          ),
          ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
            .runTime.average && {
            average: round(
              average(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(workerNode.usage.runTime.history),
                  []
                )
              )
            )
          }),
          ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
            .runTime.median && {
            median: round(
              median(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(workerNode.usage.runTime.history),
                  []
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
            min(
              ...this.workerNodes.map(
                workerNode => workerNode.usage.waitTime?.minimum ?? Infinity
              )
            )
          ),
          maximum: round(
            max(
              ...this.workerNodes.map(
                workerNode => workerNode.usage.waitTime?.maximum ?? -Infinity
              )
            )
          ),
          ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
            .waitTime.average && {
            average: round(
              average(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(workerNode.usage.waitTime.history),
                  []
                )
              )
            )
          }),
          ...(this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
            .waitTime.median && {
            median: round(
              median(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(workerNode.usage.waitTime.history),
                  []
                )
              )
            )
          })
        }
      })
    }
  }

  /**
   * The pool readiness boolean status.
   */
  private get ready (): boolean {
    return (
      this.workerNodes.reduce(
        (accumulator, workerNode) =>
          !workerNode.info.dynamic && workerNode.info.ready
            ? accumulator + 1
            : accumulator,
        0
      ) >= this.minSize
    )
  }

  /**
   * The approximate pool utilization.
   *
   * @returns The pool utilization.
   */
  private get utilization (): number {
    const poolTimeCapacity =
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
    return (totalTasksRunTime + totalTasksWaitTime) / poolTimeCapacity
  }

  /**
   * The pool type.
   *
   * If it is `'dynamic'`, it provides the `max` property.
   */
  protected abstract get type (): PoolType

  /**
   * The worker type.
   */
  protected abstract get worker (): WorkerType

  /**
   * The pool minimum size.
   */
  protected get minSize (): number {
    return this.numberOfWorkers
  }

  /**
   * The pool maximum size.
   */
  protected get maxSize (): number {
    return this.max ?? this.numberOfWorkers
  }

  /**
   * Checks if the worker id sent in the received message from a worker is valid.
   *
   * @param message - The received message.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the worker id is invalid.
   */
  private checkMessageWorkerId (message: MessageValue<Response>): void {
    if (message.workerId == null) {
      throw new Error('Worker message received without worker id')
    } else if (
      message.workerId != null &&
      this.getWorkerNodeKeyByWorkerId(message.workerId) === -1
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
  private getWorkerNodeKeyByWorker (worker: Worker): number {
    return this.workerNodes.findIndex(
      workerNode => workerNode.worker === worker
    )
  }

  /**
   * Gets the worker node key given its worker id.
   *
   * @param workerId - The worker id.
   * @returns The worker node key if the worker id is found in the pool worker nodes, `-1` otherwise.
   */
  private getWorkerNodeKeyByWorkerId (workerId: number): number {
    return this.workerNodes.findIndex(
      workerNode => workerNode.info.id === workerId
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
    for (const [workerNodeKey, workerNode] of this.workerNodes.entries()) {
      workerNode.resetUsage()
      this.sendStatisticsMessageToWorker(workerNodeKey)
    }
  }

  /** @inheritDoc */
  public setWorkerChoiceStrategyOptions (
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions
  ): void {
    this.checkValidWorkerChoiceStrategyOptions(workerChoiceStrategyOptions)
    this.opts.workerChoiceStrategyOptions = {
      ...DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS,
      ...workerChoiceStrategyOptions
    }
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
      this.unsetTaskStealing()
      this.unsetTasksStealingOnBackPressure()
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
      this.setTasksQueueSize(this.opts.tasksQueueOptions.size as number)
      if (this.opts.tasksQueueOptions.taskStealing === true) {
        this.setTaskStealing()
      } else {
        this.unsetTaskStealing()
      }
      if (this.opts.tasksQueueOptions.tasksStealingOnBackPressure === true) {
        this.setTasksStealingOnBackPressure()
      } else {
        this.unsetTasksStealingOnBackPressure()
      }
    } else if (this.opts.tasksQueueOptions != null) {
      delete this.opts.tasksQueueOptions
    }
  }

  private setTasksQueueSize (size: number): void {
    for (const workerNode of this.workerNodes) {
      workerNode.tasksQueueBackPressureSize = size
    }
  }

  private setTaskStealing (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      this.workerNodes[workerNodeKey].onEmptyQueue =
        this.taskStealingOnEmptyQueue.bind(this)
    }
  }

  private unsetTaskStealing (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      delete this.workerNodes[workerNodeKey].onEmptyQueue
    }
  }

  private setTasksStealingOnBackPressure (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      this.workerNodes[workerNodeKey].onBackPressure =
        this.tasksStealingOnBackPressure.bind(this)
    }
  }

  private unsetTasksStealingOnBackPressure (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      delete this.workerNodes[workerNodeKey].onBackPressure
    }
  }

  private buildTasksQueueOptions (
    tasksQueueOptions: TasksQueueOptions
  ): TasksQueueOptions {
    return {
      ...{
        size: Math.pow(this.maxSize, 2),
        concurrency: 1,
        taskStealing: true,
        tasksStealingOnBackPressure: true
      },
      ...tasksQueueOptions
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
   * Whether worker nodes are executing concurrently their tasks quota or not.
   *
   * @returns Worker nodes busyness boolean status.
   */
  protected internalBusy (): boolean {
    if (this.opts.enableTasksQueue === true) {
      return (
        this.workerNodes.findIndex(
          workerNode =>
            workerNode.info.ready &&
            workerNode.usage.tasks.executing <
              (this.opts.tasksQueueOptions?.concurrency as number)
        ) === -1
      )
    }
    return (
      this.workerNodes.findIndex(
        workerNode =>
          workerNode.info.ready && workerNode.usage.tasks.executing === 0
      ) === -1
    )
  }

  /** @inheritDoc */
  public listTaskFunctions (): string[] {
    for (const workerNode of this.workerNodes) {
      if (
        Array.isArray(workerNode.info.taskFunctions) &&
        workerNode.info.taskFunctions.length > 0
      ) {
        return workerNode.info.taskFunctions
      }
    }
    return []
  }

  private shallExecuteTask (workerNodeKey: number): boolean {
    return (
      this.tasksQueueSize(workerNodeKey) === 0 &&
      this.workerNodes[workerNodeKey].usage.tasks.executing <
        (this.opts.tasksQueueOptions?.concurrency as number)
    )
  }

  /** @inheritDoc */
  public async execute (
    data?: Data,
    name?: string,
    transferList?: TransferListItem[]
  ): Promise<Response> {
    return await new Promise<Response>((resolve, reject) => {
      if (!this.started) {
        reject(new Error('Cannot execute a task on not started pool'))
        return
      }
      if (name != null && typeof name !== 'string') {
        reject(new TypeError('name argument must be a string'))
        return
      }
      if (
        name != null &&
        typeof name === 'string' &&
        name.trim().length === 0
      ) {
        reject(new TypeError('name argument must not be an empty string'))
        return
      }
      if (transferList != null && !Array.isArray(transferList)) {
        reject(new TypeError('transferList argument must be an array'))
        return
      }
      const timestamp = performance.now()
      const workerNodeKey = this.chooseWorkerNode()
      const task: Task<Data> = {
        name: name ?? DEFAULT_TASK_NAME,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        data: data ?? ({} as Data),
        transferList,
        timestamp,
        workerId: this.getWorkerInfo(workerNodeKey).id as number,
        taskId: randomUUID()
      }
      this.promiseResponseMap.set(task.taskId as string, {
        resolve,
        reject,
        workerNodeKey
      })
      if (
        this.opts.enableTasksQueue === false ||
        (this.opts.enableTasksQueue === true &&
          this.shallExecuteTask(workerNodeKey))
      ) {
        this.executeTask(workerNodeKey, task)
      } else {
        this.enqueueTask(workerNodeKey, task)
      }
    })
  }

  /** @inheritdoc */
  public start (): void {
    this.starting = true
    while (
      this.workerNodes.reduce(
        (accumulator, workerNode) =>
          !workerNode.info.dynamic ? accumulator + 1 : accumulator,
        0
      ) < this.numberOfWorkers
    ) {
      this.createAndSetupWorkerNode()
    }
    this.starting = false
    this.started = true
  }

  /** @inheritDoc */
  public async destroy (): Promise<void> {
    await Promise.all(
      this.workerNodes.map(async (_, workerNodeKey) => {
        await this.destroyWorkerNode(workerNodeKey)
      })
    )
    this.emitter?.emit(PoolEvents.destroy, this.info)
    this.started = false
  }

  protected async sendKillMessageToWorker (
    workerNodeKey: number,
    workerId: number
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.registerWorkerMessageListener(workerNodeKey, message => {
        if (message.kill === 'success') {
          resolve()
        } else if (message.kill === 'failure') {
          reject(new Error(`Worker ${workerId} kill message handling failed`))
        }
      })
      this.sendToWorker(workerNodeKey, { kill: true, workerId })
    })
  }

  /**
   * Terminates the worker node given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   */
  protected abstract destroyWorkerNode (workerNodeKey: number): Promise<void>

  /**
   * Setup hook to execute code before worker nodes are created in the abstract constructor.
   * Can be overridden.
   *
   * @virtual
   */
  protected setupHook (): void {
    /* Intentionally empty */
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
    if (this.workerNodes[workerNodeKey]?.usage != null) {
      const workerUsage = this.workerNodes[workerNodeKey].usage
      ++workerUsage.tasks.executing
      this.updateWaitTimeWorkerUsage(workerUsage, task)
    }
    if (
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      this.workerNodes[workerNodeKey].getTaskFunctionWorkerUsage(
        task.name as string
      ) != null
    ) {
      const taskFunctionWorkerUsage = this.workerNodes[
        workerNodeKey
      ].getTaskFunctionWorkerUsage(task.name as string) as WorkerUsage
      ++taskFunctionWorkerUsage.tasks.executing
      this.updateWaitTimeWorkerUsage(taskFunctionWorkerUsage, task)
    }
  }

  /**
   * Hook executed after the worker task execution.
   * Can be overridden.
   *
   * @param workerNodeKey - The worker node key.
   * @param message - The received message.
   */
  protected afterTaskExecutionHook (
    workerNodeKey: number,
    message: MessageValue<Response>
  ): void {
    if (this.workerNodes[workerNodeKey]?.usage != null) {
      const workerUsage = this.workerNodes[workerNodeKey].usage
      this.updateTaskStatisticsWorkerUsage(workerUsage, message)
      this.updateRunTimeWorkerUsage(workerUsage, message)
      this.updateEluWorkerUsage(workerUsage, message)
    }
    if (
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      this.workerNodes[workerNodeKey].getTaskFunctionWorkerUsage(
        message.taskPerformance?.name as string
      ) != null
    ) {
      const taskFunctionWorkerUsage = this.workerNodes[
        workerNodeKey
      ].getTaskFunctionWorkerUsage(
        message.taskPerformance?.name as string
      ) as WorkerUsage
      this.updateTaskStatisticsWorkerUsage(taskFunctionWorkerUsage, message)
      this.updateRunTimeWorkerUsage(taskFunctionWorkerUsage, message)
      this.updateEluWorkerUsage(taskFunctionWorkerUsage, message)
    }
  }

  /**
   * Whether the worker node shall update its task function worker usage or not.
   *
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the worker node shall update its task function worker usage, `false` otherwise.
   */
  private shallUpdateTaskFunctionWorkerUsage (workerNodeKey: number): boolean {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    return (
      workerInfo != null &&
      Array.isArray(workerInfo.taskFunctions) &&
      workerInfo.taskFunctions.length > 2
    )
  }

  private updateTaskStatisticsWorkerUsage (
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void {
    const workerTaskStatistics = workerUsage.tasks
    if (
      workerTaskStatistics.executing != null &&
      workerTaskStatistics.executing > 0
    ) {
      --workerTaskStatistics.executing
    }
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
    if (message.taskError != null) {
      return
    }
    updateMeasurementStatistics(
      workerUsage.runTime,
      this.workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime,
      message.taskPerformance?.runTime ?? 0
    )
  }

  private updateWaitTimeWorkerUsage (
    workerUsage: WorkerUsage,
    task: Task<Data>
  ): void {
    const timestamp = performance.now()
    const taskWaitTime = timestamp - (task.timestamp ?? timestamp)
    updateMeasurementStatistics(
      workerUsage.waitTime,
      this.workerChoiceStrategyContext.getTaskStatisticsRequirements().waitTime,
      taskWaitTime
    )
  }

  private updateEluWorkerUsage (
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void {
    if (message.taskError != null) {
      return
    }
    const eluTaskStatisticsRequirements: MeasurementStatisticsRequirements =
      this.workerChoiceStrategyContext.getTaskStatisticsRequirements().elu
    updateMeasurementStatistics(
      workerUsage.elu.active,
      eluTaskStatisticsRequirements,
      message.taskPerformance?.elu?.active ?? 0
    )
    updateMeasurementStatistics(
      workerUsage.elu.idle,
      eluTaskStatisticsRequirements,
      message.taskPerformance?.elu?.idle ?? 0
    )
    if (eluTaskStatisticsRequirements.aggregate) {
      if (message.taskPerformance?.elu != null) {
        if (workerUsage.elu.utilization != null) {
          workerUsage.elu.utilization =
            (workerUsage.elu.utilization +
              message.taskPerformance.elu.utilization) /
            2
        } else {
          workerUsage.elu.utilization = message.taskPerformance.elu.utilization
        }
      }
    }
  }

  /**
   * Chooses a worker node for the next task.
   *
   * The default worker choice strategy uses a round robin algorithm to distribute the tasks.
   *
   * @returns The chosen worker node key
   */
  private chooseWorkerNode (): number {
    if (this.shallCreateDynamicWorker()) {
      const workerNodeKey = this.createAndSetupDynamicWorkerNode()
      if (
        this.workerChoiceStrategyContext.getStrategyPolicy().dynamicWorkerUsage
      ) {
        return workerNodeKey
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
   * Sends a message to worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param message - The message.
   * @param transferList - The optional array of transferable objects.
   */
  protected abstract sendToWorker (
    workerNodeKey: number,
    message: MessageValue<Data>,
    transferList?: TransferListItem[]
  ): void

  /**
   * Creates a new worker.
   *
   * @returns Newly created worker.
   */
  protected abstract createWorker (): Worker

  /**
   * Creates a new, completely set up worker node.
   *
   * @returns New, completely set up worker node key.
   */
  protected createAndSetupWorkerNode (): number {
    const worker = this.createWorker()

    worker.on('online', this.opts.onlineHandler ?? EMPTY_FUNCTION)
    worker.on('message', this.opts.messageHandler ?? EMPTY_FUNCTION)
    worker.on('error', this.opts.errorHandler ?? EMPTY_FUNCTION)
    worker.on('error', error => {
      const workerNodeKey = this.getWorkerNodeKeyByWorker(worker)
      const workerInfo = this.getWorkerInfo(workerNodeKey)
      workerInfo.ready = false
      this.workerNodes[workerNodeKey].closeChannel()
      this.emitter?.emit(PoolEvents.error, error)
      if (
        this.opts.restartWorkerOnError === true &&
        this.started &&
        !this.starting
      ) {
        if (workerInfo.dynamic) {
          this.createAndSetupDynamicWorkerNode()
        } else {
          this.createAndSetupWorkerNode()
        }
      }
      if (this.opts.enableTasksQueue === true) {
        this.redistributeQueuedTasks(workerNodeKey)
      }
    })
    worker.on('exit', this.opts.exitHandler ?? EMPTY_FUNCTION)
    worker.once('exit', () => {
      this.removeWorkerNode(worker)
    })

    const workerNodeKey = this.addWorkerNode(worker)

    this.afterWorkerNodeSetup(workerNodeKey)

    return workerNodeKey
  }

  /**
   * Creates a new, completely set up dynamic worker node.
   *
   * @returns New, completely set up dynamic worker node key.
   */
  protected createAndSetupDynamicWorkerNode (): number {
    const workerNodeKey = this.createAndSetupWorkerNode()
    this.registerWorkerMessageListener(workerNodeKey, message => {
      const localWorkerNodeKey = this.getWorkerNodeKeyByWorkerId(
        message.workerId
      )
      const workerUsage = this.workerNodes[localWorkerNodeKey].usage
      // Kill message received from worker
      if (
        isKillBehavior(KillBehaviors.HARD, message.kill) ||
        (isKillBehavior(KillBehaviors.SOFT, message.kill) &&
          ((this.opts.enableTasksQueue === false &&
            workerUsage.tasks.executing === 0) ||
            (this.opts.enableTasksQueue === true &&
              workerUsage.tasks.executing === 0 &&
              this.tasksQueueSize(localWorkerNodeKey) === 0)))
      ) {
        this.destroyWorkerNode(localWorkerNodeKey).catch(error => {
          this.emitter?.emit(PoolEvents.error, error)
        })
      }
    })
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    this.sendToWorker(workerNodeKey, {
      checkActive: true,
      workerId: workerInfo.id as number
    })
    workerInfo.dynamic = true
    if (
      this.workerChoiceStrategyContext.getStrategyPolicy().dynamicWorkerReady ||
      this.workerChoiceStrategyContext.getStrategyPolicy().dynamicWorkerUsage
    ) {
      workerInfo.ready = true
    }
    this.checkAndEmitDynamicWorkerCreationEvents()
    return workerNodeKey
  }

  /**
   * Registers a listener callback on the worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param listener - The message listener callback.
   */
  protected abstract registerWorkerMessageListener<
    Message extends Data | Response
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void

  /**
   * Method hooked up after a worker node has been newly created.
   * Can be overridden.
   *
   * @param workerNodeKey - The newly created worker node key.
   */
  protected afterWorkerNodeSetup (workerNodeKey: number): void {
    // Listen to worker messages.
    this.registerWorkerMessageListener(workerNodeKey, this.workerListener())
    // Send the startup message to worker.
    this.sendStartupMessageToWorker(workerNodeKey)
    // Send the statistics message to worker.
    this.sendStatisticsMessageToWorker(workerNodeKey)
    if (this.opts.enableTasksQueue === true) {
      if (this.opts.tasksQueueOptions?.taskStealing === true) {
        this.workerNodes[workerNodeKey].onEmptyQueue =
          this.taskStealingOnEmptyQueue.bind(this)
      }
      if (this.opts.tasksQueueOptions?.tasksStealingOnBackPressure === true) {
        this.workerNodes[workerNodeKey].onBackPressure =
          this.tasksStealingOnBackPressure.bind(this)
      }
    }
  }

  /**
   * Sends the startup message to worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   */
  protected abstract sendStartupMessageToWorker (workerNodeKey: number): void

  /**
   * Sends the statistics message to worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   */
  private sendStatisticsMessageToWorker (workerNodeKey: number): void {
    this.sendToWorker(workerNodeKey, {
      statistics: {
        runTime:
          this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
            .runTime.aggregate,
        elu: this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
          .elu.aggregate
      },
      workerId: this.getWorkerInfo(workerNodeKey).id as number
    })
  }

  private redistributeQueuedTasks (workerNodeKey: number): void {
    while (this.tasksQueueSize(workerNodeKey) > 0) {
      const destinationWorkerNodeKey = this.workerNodes.reduce(
        (minWorkerNodeKey, workerNode, workerNodeKey, workerNodes) => {
          return workerNode.info.ready &&
            workerNode.usage.tasks.queued <
              workerNodes[minWorkerNodeKey].usage.tasks.queued
            ? workerNodeKey
            : minWorkerNodeKey
        },
        0
      )
      const destinationWorkerNode = this.workerNodes[destinationWorkerNodeKey]
      const task = {
        ...(this.dequeueTask(workerNodeKey) as Task<Data>),
        workerId: destinationWorkerNode.info.id as number
      }
      if (this.shallExecuteTask(destinationWorkerNodeKey)) {
        this.executeTask(destinationWorkerNodeKey, task)
      } else {
        this.enqueueTask(destinationWorkerNodeKey, task)
      }
    }
  }

  private updateTaskStolenStatisticsWorkerUsage (
    workerNodeKey: number,
    taskName: string
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode?.usage != null) {
      ++workerNode.usage.tasks.stolen
    }
    if (
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      const taskFunctionWorkerUsage = workerNode.getTaskFunctionWorkerUsage(
        taskName
      ) as WorkerUsage
      ++taskFunctionWorkerUsage.tasks.stolen
    }
  }

  private taskStealingOnEmptyQueue (workerId: number): void {
    const destinationWorkerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    const destinationWorkerNode = this.workerNodes[destinationWorkerNodeKey]
    const workerNodes = this.workerNodes
      .slice()
      .sort(
        (workerNodeA, workerNodeB) =>
          workerNodeB.usage.tasks.queued - workerNodeA.usage.tasks.queued
      )
    const sourceWorkerNode = workerNodes.find(
      workerNode =>
        workerNode.info.ready &&
        workerNode.info.id !== workerId &&
        workerNode.usage.tasks.queued > 0
    )
    if (sourceWorkerNode != null) {
      const task = {
        ...(sourceWorkerNode.popTask() as Task<Data>),
        workerId: destinationWorkerNode.info.id as number
      }
      if (this.shallExecuteTask(destinationWorkerNodeKey)) {
        this.executeTask(destinationWorkerNodeKey, task)
      } else {
        this.enqueueTask(destinationWorkerNodeKey, task)
      }
      this.updateTaskStolenStatisticsWorkerUsage(
        destinationWorkerNodeKey,
        task.name as string
      )
    }
  }

  private tasksStealingOnBackPressure (workerId: number): void {
    const sizeOffset = 1
    if ((this.opts.tasksQueueOptions?.size as number) <= sizeOffset) {
      return
    }
    const sourceWorkerNode =
      this.workerNodes[this.getWorkerNodeKeyByWorkerId(workerId)]
    const workerNodes = this.workerNodes
      .slice()
      .sort(
        (workerNodeA, workerNodeB) =>
          workerNodeA.usage.tasks.queued - workerNodeB.usage.tasks.queued
      )
    for (const [workerNodeKey, workerNode] of workerNodes.entries()) {
      if (
        sourceWorkerNode.usage.tasks.queued > 0 &&
        workerNode.info.ready &&
        workerNode.info.id !== workerId &&
        workerNode.usage.tasks.queued <
          (this.opts.tasksQueueOptions?.size as number) - sizeOffset
      ) {
        const task = {
          ...(sourceWorkerNode.popTask() as Task<Data>),
          workerId: workerNode.info.id as number
        }
        if (this.shallExecuteTask(workerNodeKey)) {
          this.executeTask(workerNodeKey, task)
        } else {
          this.enqueueTask(workerNodeKey, task)
        }
        this.updateTaskStolenStatisticsWorkerUsage(
          workerNodeKey,
          task.name as string
        )
      }
    }
  }

  /**
   * This method is the listener registered for each worker message.
   *
   * @returns The listener function to execute when a message is received from a worker.
   */
  protected workerListener (): (message: MessageValue<Response>) => void {
    return message => {
      this.checkMessageWorkerId(message)
      if (message.ready != null && message.taskFunctions != null) {
        // Worker ready response received from worker
        this.handleWorkerReadyResponse(message)
      } else if (message.taskId != null) {
        // Task execution response received from worker
        this.handleTaskExecutionResponse(message)
      } else if (message.taskFunctions != null) {
        // Task functions message received from worker
        this.getWorkerInfo(
          this.getWorkerNodeKeyByWorkerId(message.workerId)
        ).taskFunctions = message.taskFunctions
      }
    }
  }

  private handleWorkerReadyResponse (message: MessageValue<Response>): void {
    if (message.ready === false) {
      throw new Error(`Worker ${message.workerId} failed to initialize`)
    }
    const workerInfo = this.getWorkerInfo(
      this.getWorkerNodeKeyByWorkerId(message.workerId)
    )
    workerInfo.ready = message.ready as boolean
    workerInfo.taskFunctions = message.taskFunctions
    if (this.emitter != null && this.ready) {
      this.emitter.emit(PoolEvents.ready, this.info)
    }
  }

  private handleTaskExecutionResponse (message: MessageValue<Response>): void {
    const { taskId, taskError, data } = message
    const promiseResponse = this.promiseResponseMap.get(taskId as string)
    if (promiseResponse != null) {
      if (taskError != null) {
        this.emitter?.emit(PoolEvents.taskError, taskError)
        promiseResponse.reject(taskError.message)
      } else {
        promiseResponse.resolve(data as Response)
      }
      const workerNodeKey = promiseResponse.workerNodeKey
      this.afterTaskExecutionHook(workerNodeKey, message)
      this.workerChoiceStrategyContext.update(workerNodeKey)
      this.promiseResponseMap.delete(taskId as string)
      if (
        this.opts.enableTasksQueue === true &&
        this.tasksQueueSize(workerNodeKey) > 0 &&
        this.workerNodes[workerNodeKey].usage.tasks.executing <
          (this.opts.tasksQueueOptions?.concurrency as number)
      ) {
        this.executeTask(
          workerNodeKey,
          this.dequeueTask(workerNodeKey) as Task<Data>
        )
      }
    }
  }

  private checkAndEmitTaskExecutionEvents (): void {
    if (this.busy) {
      this.emitter?.emit(PoolEvents.busy, this.info)
    }
  }

  private checkAndEmitTaskQueuingEvents (): void {
    if (this.hasBackPressure()) {
      this.emitter?.emit(PoolEvents.backPressure, this.info)
    }
  }

  private checkAndEmitDynamicWorkerCreationEvents (): void {
    if (this.type === PoolTypes.dynamic) {
      if (this.full) {
        this.emitter?.emit(PoolEvents.full, this.info)
      }
    }
  }

  /**
   * Gets the worker information given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @returns The worker information.
   */
  protected getWorkerInfo (workerNodeKey: number): WorkerInfo {
    return this.workerNodes[workerNodeKey].info
  }

  /**
   * Adds the given worker in the pool worker nodes.
   *
   * @param worker - The worker.
   * @returns The added worker node key.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the added worker node is not found.
   */
  private addWorkerNode (worker: Worker): number {
    const workerNode = new WorkerNode<Worker, Data>(
      worker,
      this.opts.tasksQueueOptions?.size ?? Math.pow(this.maxSize, 2)
    )
    // Flag the worker node as ready at pool startup.
    if (this.starting) {
      workerNode.info.ready = true
    }
    this.workerNodes.push(workerNode)
    const workerNodeKey = this.getWorkerNodeKeyByWorker(worker)
    if (workerNodeKey === -1) {
      throw new Error('Worker added not found in worker nodes')
    }
    return workerNodeKey
  }

  /**
   * Removes the given worker from the pool worker nodes.
   *
   * @param worker - The worker.
   */
  private removeWorkerNode (worker: Worker): void {
    const workerNodeKey = this.getWorkerNodeKeyByWorker(worker)
    if (workerNodeKey !== -1) {
      this.workerNodes.splice(workerNodeKey, 1)
      this.workerChoiceStrategyContext.remove(workerNodeKey)
    }
  }

  /** @inheritDoc */
  public hasWorkerNodeBackPressure (workerNodeKey: number): boolean {
    return (
      this.opts.enableTasksQueue === true &&
      this.workerNodes[workerNodeKey].hasBackPressure()
    )
  }

  private hasBackPressure (): boolean {
    return (
      this.opts.enableTasksQueue === true &&
      this.workerNodes.findIndex(
        workerNode => !workerNode.hasBackPressure()
      ) === -1
    )
  }

  /**
   * Executes the given task on the worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param task - The task to execute.
   */
  private executeTask (workerNodeKey: number, task: Task<Data>): void {
    this.beforeTaskExecutionHook(workerNodeKey, task)
    this.sendToWorker(workerNodeKey, task, task.transferList)
    this.checkAndEmitTaskExecutionEvents()
  }

  private enqueueTask (workerNodeKey: number, task: Task<Data>): number {
    const tasksQueueSize = this.workerNodes[workerNodeKey].enqueueTask(task)
    this.checkAndEmitTaskQueuingEvents()
    return tasksQueueSize
  }

  private dequeueTask (workerNodeKey: number): Task<Data> | undefined {
    return this.workerNodes[workerNodeKey].dequeueTask()
  }

  private tasksQueueSize (workerNodeKey: number): number {
    return this.workerNodes[workerNodeKey].tasksQueueSize()
  }

  protected flushTasksQueue (workerNodeKey: number): void {
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
}
