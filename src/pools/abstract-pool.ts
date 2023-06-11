import crypto from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type { MessageValue, PromiseResponseWrapper } from '../utility-types'
import {
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS,
  EMPTY_FUNCTION,
  isPlainObject,
  median
} from '../utils'
import { KillBehaviors, isKillBehavior } from '../worker/worker-options'
import { CircularArray } from '../circular-array'
import { Queue } from '../queue'
import {
  type IPool,
  PoolEmitter,
  PoolEvents,
  type PoolInfo,
  type PoolOptions,
  type PoolType,
  PoolTypes,
  type TasksQueueOptions,
  type WorkerType
} from './pool'
import type {
  IWorker,
  Task,
  TaskStatistics,
  WorkerNode,
  WorkerUsage
} from './worker'
import {
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions
} from './selection-strategies/selection-strategies-types'
import { WorkerChoiceStrategyContext } from './selection-strategies/worker-choice-strategy-context'

/**
 * Base class that implements some shared logic for all poolifier pools.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export abstract class AbstractPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IPool<Worker, Data, Response> {
  /** @inheritDoc */
  public readonly workerNodes: Array<WorkerNode<Worker, Data>> = []

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

    for (let i = 1; i <= this.numberOfWorkers; i++) {
      this.createAndSetupWorker()
    }
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
      throw new Error('Cannot instantiate a fixed pool with no worker')
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
  }

  private checkValidTasksQueueOptions (
    tasksQueueOptions: TasksQueueOptions
  ): void {
    if (tasksQueueOptions != null && !isPlainObject(tasksQueueOptions)) {
      throw new TypeError('Invalid tasks queue options: must be a plain object')
    }
    if ((tasksQueueOptions?.concurrency as number) <= 0) {
      throw new Error(
        `Invalid worker tasks concurrency '${
          tasksQueueOptions.concurrency as number
        }'`
      )
    }
  }

  /** @inheritDoc */
  public get info (): PoolInfo {
    return {
      type: this.type,
      worker: this.worker,
      minSize: this.minSize,
      maxSize: this.maxSize,
      workerNodes: this.workerNodes.length,
      idleWorkerNodes: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          workerNode.workerUsage.tasks.executing === 0
            ? accumulator + 1
            : accumulator,
        0
      ),
      busyWorkerNodes: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          workerNode.workerUsage.tasks.executing > 0
            ? accumulator + 1
            : accumulator,
        0
      ),
      executedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.workerUsage.tasks.executed,
        0
      ),
      executingTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.workerUsage.tasks.executing,
        0
      ),
      queuedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) => accumulator + workerNode.tasksQueue.size,
        0
      ),
      maxQueuedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.tasksQueue.maxSize,
        0
      ),
      failedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.workerUsage.tasks.failed,
        0
      )
    }
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
   * Gets the given worker its worker node key.
   *
   * @param worker - The worker.
   * @returns The worker node key if the worker is found in the pool worker nodes, `-1` otherwise.
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
      this.setWorkerNodeTasksUsage(
        workerNode,
        this.getWorkerUsage(workerNode.worker)
      )
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

  protected internalBusy (): boolean {
    return (
      this.workerNodes.findIndex(workerNode => {
        return workerNode.workerUsage.tasks.executing === 0
      }) === -1
    )
  }

  /** @inheritDoc */
  public async execute (data?: Data, name?: string): Promise<Response> {
    const timestamp = performance.now()
    const workerNodeKey = this.chooseWorkerNode()
    const submittedTask: Task<Data> = {
      name,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      data: data ?? ({} as Data),
      timestamp,
      id: crypto.randomUUID()
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
        this.workerNodes[workerNodeKey].workerUsage.tasks.executing >=
          ((this.opts.tasksQueueOptions as TasksQueueOptions)
            .concurrency as number))
    ) {
      this.enqueueTask(workerNodeKey, submittedTask)
    } else {
      this.executeTask(workerNodeKey, submittedTask)
    }
    this.workerChoiceStrategyContext.update(workerNodeKey)
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
        await this.destroyWorker(workerNode.worker)
      })
    )
  }

  /**
   * Shutdowns the given worker.
   *
   * @param worker - A worker within `workerNodes`.
   */
  protected abstract destroyWorker (worker: Worker): void | Promise<void>

  /**
   * Setup hook to execute code before worker node are created in the abstract constructor.
   * Can be overridden
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
    const workerUsage = this.workerNodes[workerNodeKey].workerUsage
    ++workerUsage.tasks.executing
    this.updateWaitTimeWorkerUsage(workerUsage, task)
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
    const workerUsage =
      this.workerNodes[this.getWorkerNodeKey(worker)].workerUsage
    this.updateTaskStatisticsWorkerUsage(workerUsage, message)
    this.updateRunTimeWorkerUsage(workerUsage, message)
    this.updateEluWorkerUsage(workerUsage, message)
  }

  private updateTaskStatisticsWorkerUsage (
    workerUsage: WorkerUsage,
    message: MessageValue<Response>
  ): void {
    const workerTaskStatistics = workerUsage.tasks
    --workerTaskStatistics.executing
    ++workerTaskStatistics.executed
    if (message.taskError != null) {
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
      workerUsage.runTime.aggregate += message.taskPerformance?.runTime ?? 0
      if (
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .average &&
        workerUsage.tasks.executed !== 0
      ) {
        workerUsage.runTime.average =
          workerUsage.runTime.aggregate /
          (workerUsage.tasks.executed - workerUsage.tasks.failed)
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
      workerUsage.waitTime.aggregate += taskWaitTime ?? 0
      if (
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
          .waitTime.average &&
        workerUsage.tasks.executed !== 0
      ) {
        workerUsage.waitTime.average =
          workerUsage.waitTime.aggregate /
          (workerUsage.tasks.executed - workerUsage.tasks.failed)
      }
      if (
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements()
          .waitTime.median &&
        taskWaitTime != null
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
      if (workerUsage.elu != null && message.taskPerformance?.elu != null) {
        workerUsage.elu.idle.aggregate += message.taskPerformance.elu.idle
        workerUsage.elu.active.aggregate += message.taskPerformance.elu.active
        workerUsage.elu.utilization =
          (workerUsage.elu.utilization +
            message.taskPerformance.elu.utilization) /
          2
      } else if (message.taskPerformance?.elu != null) {
        workerUsage.elu.idle.aggregate = message.taskPerformance.elu.idle
        workerUsage.elu.active.aggregate = message.taskPerformance.elu.active
        workerUsage.elu.utilization = message.taskPerformance.elu.utilization
      }
      if (
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements().elu
          .average &&
        workerUsage.tasks.executed !== 0
      ) {
        const executedTasks =
          workerUsage.tasks.executed - workerUsage.tasks.failed
        workerUsage.elu.idle.average =
          workerUsage.elu.idle.aggregate / executedTasks
        workerUsage.elu.active.average =
          workerUsage.elu.active.aggregate / executedTasks
      }
      if (
        this.workerChoiceStrategyContext.getTaskStatisticsRequirements().elu
          .median &&
        message.taskPerformance?.elu != null
      ) {
        workerUsage.elu.idle.history.push(message.taskPerformance.elu.idle)
        workerUsage.elu.active.history.push(message.taskPerformance.elu.active)
        workerUsage.elu.idle.median = median(workerUsage.elu.idle.history)
        workerUsage.elu.active.median = median(workerUsage.elu.active.history)
      }
    }
  }

  /**
   * Chooses a worker node for the next task.
   *
   * The default worker choice strategy uses a round robin algorithm to distribute the load.
   *
   * @returns The worker node key
   */
  protected chooseWorkerNode (): number {
    if (this.shallCreateDynamicWorker()) {
      return this.getWorkerNodeKey(this.createAndSetupDynamicWorker())
    }
    return this.workerChoiceStrategyContext.execute()
  }

  protected shallCreateDynamicWorker (): boolean {
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
  protected abstract registerWorkerMessageListener<
    Message extends Data | Response
  >(worker: Worker, listener: (message: MessageValue<Message>) => void): void

  /**
   * Returns a newly created worker.
   */
  protected abstract createWorker (): Worker

  /**
   * Function that can be hooked up when a worker has been newly created and moved to the pool worker nodes.
   *
   * Can be used to update the `maxListeners` or binding the `main-worker`\<-\>`worker` connection if not bind by default.
   *
   * @param worker - The newly created worker.
   */
  protected abstract afterWorkerSetup (worker: Worker): void

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
      if (this.opts.restartWorkerOnError === true) {
        this.createAndSetupWorker()
      }
    })
    worker.on('online', this.opts.onlineHandler ?? EMPTY_FUNCTION)
    worker.on('exit', this.opts.exitHandler ?? EMPTY_FUNCTION)
    worker.once('exit', () => {
      this.removeWorkerNode(worker)
    })

    this.pushWorkerNode(worker)

    this.setWorkerStatistics(worker)

    this.afterWorkerSetup(worker)

    return worker
  }

  /**
   * Creates a new dynamic worker and sets it up completely in the pool worker nodes.
   *
   * @returns New, completely set up dynamic worker.
   */
  protected createAndSetupDynamicWorker (): Worker {
    const worker = this.createAndSetupWorker()
    this.registerWorkerMessageListener(worker, message => {
      const currentWorkerNodeKey = this.getWorkerNodeKey(worker)
      if (
        isKillBehavior(KillBehaviors.HARD, message.kill) ||
        (message.kill != null &&
          this.workerNodes[currentWorkerNodeKey].workerUsage.tasks.executing ===
            0)
      ) {
        // Kill message received from the worker: no new tasks are submitted to that worker for a while ( > maxInactiveTime)
        this.flushTasksQueue(currentWorkerNodeKey)
        // FIXME: wait for tasks to be finished
        void (this.destroyWorker(worker) as Promise<void>)
      }
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
      if (message.id != null) {
        // Task execution response received
        const promiseResponse = this.promiseResponseMap.get(message.id)
        if (promiseResponse != null) {
          if (message.taskError != null) {
            promiseResponse.reject(message.taskError.message)
            if (this.emitter != null) {
              this.emitter.emit(PoolEvents.taskError, message.taskError)
            }
          } else {
            promiseResponse.resolve(message.data as Response)
          }
          this.afterTaskExecutionHook(promiseResponse.worker, message)
          this.promiseResponseMap.delete(message.id)
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
        }
      }
    }
  }

  private checkAndEmitEvents (): void {
    if (this.emitter != null) {
      if (this.busy) {
        this.emitter?.emit(PoolEvents.busy, this.info)
      }
      if (this.type === PoolTypes.dynamic && this.full) {
        this.emitter?.emit(PoolEvents.full, this.info)
      }
    }
  }

  /**
   * Sets the given worker node its tasks usage in the pool.
   *
   * @param workerNode - The worker node.
   * @param workerUsage - The worker usage.
   */
  private setWorkerNodeTasksUsage (
    workerNode: WorkerNode<Worker, Data>,
    workerUsage: WorkerUsage
  ): void {
    workerNode.workerUsage = workerUsage
  }

  /**
   * Pushes the given worker in the pool worker nodes.
   *
   * @param worker - The worker.
   * @returns The worker nodes length.
   */
  private pushWorkerNode (worker: Worker): number {
    return this.workerNodes.push({
      worker,
      workerUsage: this.getWorkerUsage(worker),
      tasksQueue: new Queue<Task<Data>>()
    })
  }

  // /**
  //  * Sets the given worker in the pool worker nodes.
  //  *
  //  * @param workerNodeKey - The worker node key.
  //  * @param worker - The worker.
  //  * @param workerUsage - The worker usage.
  //  * @param tasksQueue - The worker task queue.
  //  */
  // private setWorkerNode (
  //   workerNodeKey: number,
  //   worker: Worker,
  //   workerUsage: WorkerUsage,
  //   tasksQueue: Queue<Task<Data>>
  // ): void {
  //   this.workerNodes[workerNodeKey] = {
  //     worker,
  //     workerUsage,
  //     tasksQueue
  //   }
  // }

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
    return this.workerNodes[workerNodeKey].tasksQueue.enqueue(task)
  }

  private dequeueTask (workerNodeKey: number): Task<Data> | undefined {
    return this.workerNodes[workerNodeKey].tasksQueue.dequeue()
  }

  private tasksQueueSize (workerNodeKey: number): number {
    return this.workerNodes[workerNodeKey].tasksQueue.size
  }

  private flushTasksQueue (workerNodeKey: number): void {
    if (this.tasksQueueSize(workerNodeKey) > 0) {
      for (let i = 0; i < this.tasksQueueSize(workerNodeKey); i++) {
        this.executeTask(
          workerNodeKey,
          this.dequeueTask(workerNodeKey) as Task<Data>
        )
      }
    }
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
      }
    })
  }

  private getWorkerUsage (worker: Worker): WorkerUsage {
    return {
      tasks: this.getTaskStatistics(worker),
      runTime: {
        aggregate: 0,
        average: 0,
        median: 0,
        history: new CircularArray()
      },
      waitTime: {
        aggregate: 0,
        average: 0,
        median: 0,
        history: new CircularArray()
      },
      elu: {
        idle: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: new CircularArray()
        },
        active: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: new CircularArray()
        },
        utilization: 0
      }
    }
  }

  private getTaskStatistics (worker: Worker): TaskStatistics {
    const queueSize =
      this.workerNodes[this.getWorkerNodeKey(worker)]?.tasksQueue?.size
    return {
      executed: 0,
      executing: 0,
      get queued (): number {
        return queueSize ?? 0
      },
      failed: 0
    }
  }
}
