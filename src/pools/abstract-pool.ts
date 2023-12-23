import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type { TransferListItem } from 'node:worker_threads'
import { EventEmitterAsyncResource } from 'node:events'
import { AsyncResource } from 'node:async_hooks'
import type {
  MessageValue,
  PromiseResponseWrapper,
  Task
} from '../utility-types'
import {
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  average,
  exponentialDelay,
  isKillBehavior,
  isPlainObject,
  max,
  median,
  min,
  round,
  sleep
} from '../utils'
import { KillBehaviors } from '../worker/worker-options'
import type { TaskFunction } from '../worker/task-functions'
import {
  type IPool,
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
  TaskStatistics,
  WorkerInfo,
  WorkerNodeEventDetail,
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
import {
  checkFilePath,
  checkValidTasksQueueOptions,
  checkValidWorkerChoiceStrategy,
  getDefaultTasksQueueOptions,
  updateEluWorkerUsage,
  updateRunTimeWorkerUsage,
  updateTaskStatisticsWorkerUsage,
  updateWaitTimeWorkerUsage,
  waitWorkerNodeEvents
} from './utils'

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
  public emitter?: EventEmitterAsyncResource

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
   * The task functions added at runtime map:
   * - `key`: The task function name.
   * - `value`: The task function itself.
   */
  private readonly taskFunctions: Map<string, TaskFunction<Data, Response>>

  /**
   * Whether the pool is started or not.
   */
  private started: boolean
  /**
   * Whether the pool is starting or not.
   */
  private starting: boolean
  /**
   * Whether the pool is destroying or not.
   */
  private destroying: boolean
  /**
   * Whether the pool ready event has been emitted or not.
   */
  private readyEventEmitted: boolean
  /**
   * The start timestamp of the pool.
   */
  private readonly startTimestamp

  /**
   * Constructs a new poolifier pool.
   *
   * @param minimumNumberOfWorkers - Minimum number of workers that this pool manages.
   * @param filePath - Path to the worker file.
   * @param opts - Options for the pool.
   * @param maximumNumberOfWorkers - Maximum number of workers that this pool manages.
   */
  public constructor (
    protected readonly minimumNumberOfWorkers: number,
    protected readonly filePath: string,
    protected readonly opts: PoolOptions<Worker>,
    protected readonly maximumNumberOfWorkers?: number
  ) {
    if (!this.isMain()) {
      throw new Error(
        'Cannot start a pool from a worker with the same type as the pool'
      )
    }
    this.checkPoolType()
    checkFilePath(this.filePath)
    this.checkMinimumNumberOfWorkers(this.minimumNumberOfWorkers)
    this.checkPoolOptions(this.opts)

    this.chooseWorkerNode = this.chooseWorkerNode.bind(this)
    this.executeTask = this.executeTask.bind(this)
    this.enqueueTask = this.enqueueTask.bind(this)

    if (this.opts.enableEvents === true) {
      this.initializeEventEmitter()
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

    this.taskFunctions = new Map<string, TaskFunction<Data, Response>>()

    this.started = false
    this.starting = false
    this.destroying = false
    this.readyEventEmitted = false
    if (this.opts.startWorkers === true) {
      this.start()
    }

    this.startTimestamp = performance.now()
  }

  private checkPoolType (): void {
    if (this.type === PoolTypes.fixed && this.maximumNumberOfWorkers != null) {
      throw new Error(
        'Cannot instantiate a fixed pool with a maximum number of workers specified at initialization'
      )
    }
  }

  private checkMinimumNumberOfWorkers (minimumNumberOfWorkers: number): void {
    if (minimumNumberOfWorkers == null) {
      throw new Error(
        'Cannot instantiate a pool without specifying the number of workers'
      )
    } else if (!Number.isSafeInteger(minimumNumberOfWorkers)) {
      throw new TypeError(
        'Cannot instantiate a pool with a non safe integer number of workers'
      )
    } else if (minimumNumberOfWorkers < 0) {
      throw new RangeError(
        'Cannot instantiate a pool with a negative number of workers'
      )
    } else if (this.type === PoolTypes.fixed && minimumNumberOfWorkers === 0) {
      throw new RangeError('Cannot instantiate a fixed pool with zero worker')
    }
  }

  private checkPoolOptions (opts: PoolOptions<Worker>): void {
    if (isPlainObject(opts)) {
      this.opts.startWorkers = opts.startWorkers ?? true
      checkValidWorkerChoiceStrategy(
        opts.workerChoiceStrategy as WorkerChoiceStrategy
      )
      this.opts.workerChoiceStrategy =
        opts.workerChoiceStrategy ?? WorkerChoiceStrategies.ROUND_ROBIN
      this.checkValidWorkerChoiceStrategyOptions(
        opts.workerChoiceStrategyOptions as WorkerChoiceStrategyOptions
      )
      if (opts.workerChoiceStrategyOptions != null) {
        this.opts.workerChoiceStrategyOptions = opts.workerChoiceStrategyOptions
      }
      this.opts.restartWorkerOnError = opts.restartWorkerOnError ?? true
      this.opts.enableEvents = opts.enableEvents ?? true
      this.opts.enableTasksQueue = opts.enableTasksQueue ?? false
      if (this.opts.enableTasksQueue) {
        checkValidTasksQueueOptions(opts.tasksQueueOptions as TasksQueueOptions)
        this.opts.tasksQueueOptions = this.buildTasksQueueOptions(
          opts.tasksQueueOptions as TasksQueueOptions
        )
      }
    } else {
      throw new TypeError('Invalid pool options: must be a plain object')
    }
  }

  private checkValidWorkerChoiceStrategyOptions (
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions
  ): void {
    if (
      workerChoiceStrategyOptions != null &&
      !isPlainObject(workerChoiceStrategyOptions)
    ) {
      throw new TypeError(
        'Invalid worker choice strategy options: must be a plain object'
      )
    }
    if (
      workerChoiceStrategyOptions?.weights != null &&
      Object.keys(workerChoiceStrategyOptions.weights).length !==
        (this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers)
    ) {
      throw new Error(
        'Invalid worker choice strategy options: must have a weight for each worker node'
      )
    }
    if (
      workerChoiceStrategyOptions?.measurement != null &&
      !Object.values(Measurements).includes(
        workerChoiceStrategyOptions.measurement
      )
    ) {
      throw new Error(
        `Invalid worker choice strategy options: invalid measurement '${workerChoiceStrategyOptions.measurement}'`
      )
    }
  }

  private initializeEventEmitter (): void {
    this.emitter = new EventEmitterAsyncResource({
      name: `poolifier:${this.type}-${this.worker}-pool`
    })
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
      minSize: this.minimumNumberOfWorkers,
      maxSize: this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
      ...(this.workerChoiceStrategyContext?.getTaskStatisticsRequirements()
        .runTime.aggregate &&
        this.workerChoiceStrategyContext?.getTaskStatisticsRequirements()
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
        (accumulator, _workerNode, workerNodeKey) =>
          this.isWorkerNodeBusy(workerNodeKey) ? accumulator + 1 : accumulator,
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
      ...(this.workerChoiceStrategyContext?.getTaskStatisticsRequirements()
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
          ...(this.workerChoiceStrategyContext?.getTaskStatisticsRequirements()
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
          ...(this.workerChoiceStrategyContext?.getTaskStatisticsRequirements()
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
      ...(this.workerChoiceStrategyContext?.getTaskStatisticsRequirements()
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
          ...(this.workerChoiceStrategyContext?.getTaskStatisticsRequirements()
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
          ...(this.workerChoiceStrategyContext?.getTaskStatisticsRequirements()
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
      ) >= this.minimumNumberOfWorkers
    )
  }

  /**
   * The approximate pool utilization.
   *
   * @returns The pool utilization.
   */
  private get utilization (): number {
    const poolTimeCapacity =
      (performance.now() - this.startTimestamp) *
      (this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers)
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
   * Checks if the worker id sent in the received message from a worker is valid.
   *
   * @param message - The received message.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the worker id is invalid.
   */
  private checkMessageWorkerId (message: MessageValue<Data | Response>): void {
    if (message.workerId == null) {
      throw new Error('Worker message received without worker id')
    } else if (this.getWorkerNodeKeyByWorkerId(message.workerId) === -1) {
      throw new Error(
        `Worker message received from unknown worker '${message.workerId}'`
      )
    }
  }

  /**
   * Gets the worker node key given its worker id.
   *
   * @param workerId - The worker id.
   * @returns The worker node key if the worker id is found in the pool worker nodes, `-1` otherwise.
   */
  private getWorkerNodeKeyByWorkerId (workerId: number | undefined): number {
    return this.workerNodes.findIndex(
      workerNode => workerNode.info.id === workerId
    )
  }

  /** @inheritDoc */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy,
    workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  ): void {
    checkValidWorkerChoiceStrategy(workerChoiceStrategy)
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
    if (workerChoiceStrategyOptions != null) {
      this.opts.workerChoiceStrategyOptions = workerChoiceStrategyOptions
    }
    this.workerChoiceStrategyContext.setOptions(
      this,
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
      checkValidTasksQueueOptions(tasksQueueOptions)
      this.opts.tasksQueueOptions =
        this.buildTasksQueueOptions(tasksQueueOptions)
      this.setTasksQueueSize(this.opts.tasksQueueOptions.size as number)
      if (this.opts.tasksQueueOptions.taskStealing === true) {
        this.unsetTaskStealing()
        this.setTaskStealing()
      } else {
        this.unsetTaskStealing()
      }
      if (this.opts.tasksQueueOptions.tasksStealingOnBackPressure === true) {
        this.unsetTasksStealingOnBackPressure()
        this.setTasksStealingOnBackPressure()
      } else {
        this.unsetTasksStealingOnBackPressure()
      }
    } else if (this.opts.tasksQueueOptions != null) {
      delete this.opts.tasksQueueOptions
    }
  }

  private buildTasksQueueOptions (
    tasksQueueOptions: TasksQueueOptions
  ): TasksQueueOptions {
    return {
      ...getDefaultTasksQueueOptions(
        this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
      ),
      ...tasksQueueOptions
    }
  }

  private setTasksQueueSize (size: number): void {
    for (const workerNode of this.workerNodes) {
      workerNode.tasksQueueBackPressureSize = size
    }
  }

  private setTaskStealing (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      this.workerNodes[workerNodeKey].on(
        'idleWorkerNode',
        this.handleIdleWorkerNodeEvent
      )
    }
  }

  private unsetTaskStealing (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      this.workerNodes[workerNodeKey].off(
        'idleWorkerNode',
        this.handleIdleWorkerNodeEvent
      )
    }
  }

  private setTasksStealingOnBackPressure (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      this.workerNodes[workerNodeKey].on(
        'backPressure',
        this.handleBackPressureEvent
      )
    }
  }

  private unsetTasksStealingOnBackPressure (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      this.workerNodes[workerNodeKey].off(
        'backPressure',
        this.handleBackPressureEvent
      )
    }
  }

  /**
   * Whether the pool is full or not.
   *
   * The pool filling boolean status.
   */
  protected get full (): boolean {
    return (
      this.workerNodes.length >=
      (this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers)
    )
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

  private isWorkerNodeBusy (workerNodeKey: number): boolean {
    if (this.opts.enableTasksQueue === true) {
      return (
        this.workerNodes[workerNodeKey].usage.tasks.executing >=
        (this.opts.tasksQueueOptions?.concurrency as number)
      )
    }
    return this.workerNodes[workerNodeKey].usage.tasks.executing > 0
  }

  private async sendTaskFunctionOperationToWorker (
    workerNodeKey: number,
    message: MessageValue<Data>
  ): Promise<boolean> {
    return await new Promise<boolean>((resolve, reject) => {
      const taskFunctionOperationListener = (
        message: MessageValue<Response>
      ): void => {
        this.checkMessageWorkerId(message)
        const workerId = this.getWorkerInfo(workerNodeKey).id as number
        if (
          message.taskFunctionOperationStatus != null &&
          message.workerId === workerId
        ) {
          if (message.taskFunctionOperationStatus) {
            resolve(true)
          } else if (!message.taskFunctionOperationStatus) {
            reject(
              new Error(
                `Task function operation '${
                  message.taskFunctionOperation as string
                }' failed on worker ${message.workerId} with error: '${
                  message.workerError?.message as string
                }'`
              )
            )
          }
          this.deregisterWorkerMessageListener(
            this.getWorkerNodeKeyByWorkerId(message.workerId),
            taskFunctionOperationListener
          )
        }
      }
      this.registerWorkerMessageListener(
        workerNodeKey,
        taskFunctionOperationListener
      )
      this.sendToWorker(workerNodeKey, message)
    })
  }

  private async sendTaskFunctionOperationToWorkers (
    message: MessageValue<Data>
  ): Promise<boolean> {
    return await new Promise<boolean>((resolve, reject) => {
      const responsesReceived = new Array<MessageValue<Response>>()
      const taskFunctionOperationsListener = (
        message: MessageValue<Response>
      ): void => {
        this.checkMessageWorkerId(message)
        if (message.taskFunctionOperationStatus != null) {
          responsesReceived.push(message)
          if (responsesReceived.length === this.workerNodes.length) {
            if (
              responsesReceived.every(
                message => message.taskFunctionOperationStatus === true
              )
            ) {
              resolve(true)
            } else if (
              responsesReceived.some(
                message => message.taskFunctionOperationStatus === false
              )
            ) {
              const errorResponse = responsesReceived.find(
                response => response.taskFunctionOperationStatus === false
              )
              reject(
                new Error(
                  `Task function operation '${
                    message.taskFunctionOperation as string
                  }' failed on worker ${
                    errorResponse?.workerId as number
                  } with error: '${
                    errorResponse?.workerError?.message as string
                  }'`
                )
              )
            }
            this.deregisterWorkerMessageListener(
              this.getWorkerNodeKeyByWorkerId(message.workerId),
              taskFunctionOperationsListener
            )
          }
        }
      }
      for (const [workerNodeKey] of this.workerNodes.entries()) {
        this.registerWorkerMessageListener(
          workerNodeKey,
          taskFunctionOperationsListener
        )
        this.sendToWorker(workerNodeKey, message)
      }
    })
  }

  /** @inheritDoc */
  public hasTaskFunction (name: string): boolean {
    for (const workerNode of this.workerNodes) {
      if (
        Array.isArray(workerNode.info.taskFunctionNames) &&
        workerNode.info.taskFunctionNames.includes(name)
      ) {
        return true
      }
    }
    return false
  }

  /** @inheritDoc */
  public async addTaskFunction (
    name: string,
    fn: TaskFunction<Data, Response>
  ): Promise<boolean> {
    if (typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (typeof fn !== 'function') {
      throw new TypeError('fn argument must be a function')
    }
    const opResult = await this.sendTaskFunctionOperationToWorkers({
      taskFunctionOperation: 'add',
      taskFunctionName: name,
      taskFunction: fn.toString()
    })
    this.taskFunctions.set(name, fn)
    return opResult
  }

  /** @inheritDoc */
  public async removeTaskFunction (name: string): Promise<boolean> {
    if (!this.taskFunctions.has(name)) {
      throw new Error(
        'Cannot remove a task function not handled on the pool side'
      )
    }
    const opResult = await this.sendTaskFunctionOperationToWorkers({
      taskFunctionOperation: 'remove',
      taskFunctionName: name
    })
    this.deleteTaskFunctionWorkerUsages(name)
    this.taskFunctions.delete(name)
    return opResult
  }

  /** @inheritDoc */
  public listTaskFunctionNames (): string[] {
    for (const workerNode of this.workerNodes) {
      if (
        Array.isArray(workerNode.info.taskFunctionNames) &&
        workerNode.info.taskFunctionNames.length > 0
      ) {
        return workerNode.info.taskFunctionNames
      }
    }
    return []
  }

  /** @inheritDoc */
  public async setDefaultTaskFunction (name: string): Promise<boolean> {
    return await this.sendTaskFunctionOperationToWorkers({
      taskFunctionOperation: 'default',
      taskFunctionName: name
    })
  }

  private deleteTaskFunctionWorkerUsages (name: string): void {
    for (const workerNode of this.workerNodes) {
      workerNode.deleteTaskFunctionWorkerUsage(name)
    }
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
    transferList?: TransferListItem[],
    abortSignal?: AbortSignal
  ): Promise<Response> {
    return await new Promise<Response>((resolve, reject) => {
      if (!this.started) {
        reject(new Error('Cannot execute a task on not started pool'))
        return
      }
      if (this.destroying) {
        reject(new Error('Cannot execute a task on destroying pool'))
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
      if (abortSignal != null && !(abortSignal instanceof AbortSignal)) {
        reject(new TypeError('abortSignal argument must be an AbortSignal'))
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
        abortable: abortSignal != null,
        taskId: randomUUID()
      }
      abortSignal?.addEventListener(
        'abort',
        () => {
          this.workerNodes[workerNodeKey].emit('abortTask', {
            workerId: this.getWorkerInfo(workerNodeKey).id as number,
            taskId: task.taskId
          })
        },
        { once: true }
      )
      this.promiseResponseMap.set(task.taskId as string, {
        resolve,
        reject,
        workerNodeKey,
        ...(this.emitter != null && {
          asyncResource: new AsyncResource('poolifier:task', {
            triggerAsyncId: this.emitter.asyncId,
            requireManualDestroy: true
          })
        }),
        abortSignal
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
    if (this.started) {
      throw new Error('Cannot start an already started pool')
    }
    if (this.starting) {
      throw new Error('Cannot start an already starting pool')
    }
    if (this.destroying) {
      throw new Error('Cannot start a destroying pool')
    }
    this.starting = true
    while (
      this.workerNodes.reduce(
        (accumulator, workerNode) =>
          !workerNode.info.dynamic ? accumulator + 1 : accumulator,
        0
      ) < this.minimumNumberOfWorkers
    ) {
      this.createAndSetupWorkerNode()
    }
    this.starting = false
    this.started = true
  }

  /** @inheritDoc */
  public async destroy (): Promise<void> {
    if (!this.started) {
      throw new Error('Cannot destroy an already destroyed pool')
    }
    if (this.starting) {
      throw new Error('Cannot destroy an starting pool')
    }
    if (this.destroying) {
      throw new Error('Cannot destroy an already destroying pool')
    }
    this.destroying = true
    await Promise.all(
      this.workerNodes.map(async (_workerNode, workerNodeKey) => {
        await this.destroyWorkerNode(workerNodeKey)
      })
    )
    this.emitter?.emit(PoolEvents.destroy, this.info)
    this.emitter?.emitDestroy()
    this.emitter?.removeAllListeners()
    this.readyEventEmitted = false
    this.destroying = false
    this.started = false
  }

  private async sendKillMessageToWorker (workerNodeKey: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (this.workerNodes?.[workerNodeKey] == null) {
        resolve()
        return
      }
      const killMessageListener = (message: MessageValue<Response>): void => {
        this.checkMessageWorkerId(message)
        if (message.kill === 'success') {
          resolve()
        } else if (message.kill === 'failure') {
          reject(
            new Error(
              `Kill message handling failed on worker ${
                message.workerId as number
              }`
            )
          )
        }
      }
      // FIXME: should be registered only once
      this.registerWorkerMessageListener(workerNodeKey, killMessageListener)
      this.sendToWorker(workerNodeKey, { kill: true })
    })
  }

  /**
   * Terminates the worker node given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   */
  protected async destroyWorkerNode (workerNodeKey: number): Promise<void> {
    this.flagWorkerNodeAsNotReady(workerNodeKey)
    const flushedTasks = this.flushTasksQueue(workerNodeKey)
    const workerNode = this.workerNodes[workerNodeKey]
    await waitWorkerNodeEvents(
      workerNode,
      'taskFinished',
      flushedTasks,
      this.opts.tasksQueueOptions?.tasksFinishedTimeout ??
        getDefaultTasksQueueOptions(
          this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
        ).tasksFinishedTimeout
    )
    await this.sendKillMessageToWorker(workerNodeKey)
    await workerNode.terminate()
  }

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
      updateWaitTimeWorkerUsage(
        this.workerChoiceStrategyContext,
        workerUsage,
        task
      )
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
      updateWaitTimeWorkerUsage(
        this.workerChoiceStrategyContext,
        taskFunctionWorkerUsage,
        task
      )
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
    let needWorkerChoiceStrategyUpdate = false
    if (this.workerNodes[workerNodeKey]?.usage != null) {
      const workerUsage = this.workerNodes[workerNodeKey].usage
      updateTaskStatisticsWorkerUsage(workerUsage, message)
      updateRunTimeWorkerUsage(
        this.workerChoiceStrategyContext,
        workerUsage,
        message
      )
      updateEluWorkerUsage(
        this.workerChoiceStrategyContext,
        workerUsage,
        message
      )
      needWorkerChoiceStrategyUpdate = true
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
      updateTaskStatisticsWorkerUsage(taskFunctionWorkerUsage, message)
      updateRunTimeWorkerUsage(
        this.workerChoiceStrategyContext,
        taskFunctionWorkerUsage,
        message
      )
      updateEluWorkerUsage(
        this.workerChoiceStrategyContext,
        taskFunctionWorkerUsage,
        message
      )
      needWorkerChoiceStrategyUpdate = true
    }
    if (needWorkerChoiceStrategyUpdate) {
      this.workerChoiceStrategyContext.update(workerNodeKey)
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
      Array.isArray(workerInfo.taskFunctionNames) &&
      workerInfo.taskFunctionNames.length > 2
    )
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
  protected abstract shallCreateDynamicWorker (): boolean

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
   * Creates a new, completely set up worker node.
   *
   * @returns New, completely set up worker node key.
   */
  protected createAndSetupWorkerNode (): number {
    const workerNode = this.createWorkerNode()
    workerNode.registerWorkerEventHandler(
      'online',
      this.opts.onlineHandler ?? EMPTY_FUNCTION
    )
    workerNode.registerWorkerEventHandler(
      'message',
      this.opts.messageHandler ?? EMPTY_FUNCTION
    )
    workerNode.registerWorkerEventHandler(
      'error',
      this.opts.errorHandler ?? EMPTY_FUNCTION
    )
    workerNode.registerWorkerEventHandler('error', (error: Error) => {
      workerNode.info.ready = false
      this.emitter?.emit(PoolEvents.error, error)
      if (
        this.started &&
        !this.starting &&
        !this.destroying &&
        this.opts.restartWorkerOnError === true
      ) {
        if (workerNode.info.dynamic) {
          this.createAndSetupDynamicWorkerNode()
        } else {
          this.createAndSetupWorkerNode()
        }
      }
      if (this.started && this.opts.enableTasksQueue === true) {
        this.redistributeQueuedTasks(this.workerNodes.indexOf(workerNode))
      }
      workerNode?.terminate().catch(error => {
        this.emitter?.emit(PoolEvents.error, error)
      })
    })
    workerNode.registerWorkerEventHandler(
      'exit',
      this.opts.exitHandler ?? EMPTY_FUNCTION
    )
    workerNode.registerOnceWorkerEventHandler('exit', () => {
      this.removeWorkerNode(workerNode)
    })
    const workerNodeKey = this.addWorkerNode(workerNode)
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
      this.checkMessageWorkerId(message)
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
        // Flag the worker node as not ready immediately
        this.flagWorkerNodeAsNotReady(localWorkerNodeKey)
        this.destroyWorkerNode(localWorkerNodeKey).catch(error => {
          this.emitter?.emit(PoolEvents.error, error)
        })
      }
    })
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    this.sendToWorker(workerNodeKey, {
      checkActive: true
    })
    if (this.taskFunctions.size > 0) {
      for (const [taskFunctionName, taskFunction] of this.taskFunctions) {
        this.sendTaskFunctionOperationToWorker(workerNodeKey, {
          taskFunctionOperation: 'add',
          taskFunctionName,
          taskFunction: taskFunction.toString()
        }).catch(error => {
          this.emitter?.emit(PoolEvents.error, error)
        })
      }
    }
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
   * Registers once a listener callback on the worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param listener - The message listener callback.
   */
  protected abstract registerOnceWorkerMessageListener<
    Message extends Data | Response
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void

  /**
   * Deregisters a listener callback on the worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param listener - The message listener callback.
   */
  protected abstract deregisterWorkerMessageListener<
    Message extends Data | Response
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void

  private readonly abortTask = (eventDetail: WorkerNodeEventDetail): void => {
    const { workerId, taskId } = eventDetail
    const { reject, abortSignal } = this.promiseResponseMap.get(
      taskId as string
    ) as PromiseResponseWrapper<Response>
    const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    if (this.opts.enableTasksQueue === true) {
      for (const task of this.workerNodes[workerNodeKey].tasksQueue) {
        const { name, abortable } = task
        if (taskId === task.taskId && abortable === true) {
          this.workerNodes[workerNodeKey].deleteTask(task)
          this.promiseResponseMap.delete(taskId as string)
          reject(
            new Error(`Task ${name as string} id ${taskId as string} aborted`)
          )
          return
        }
      }
    }
    if (abortSignal != null) {
      this.sendToWorker(workerNodeKey, { taskId, taskOperation: 'abort' })
    }
  }

  /**
   * Method hooked up after a worker node has been newly created.
   * Can be overridden.
   *
   * @param workerNodeKey - The newly created worker node key.
   */
  protected afterWorkerNodeSetup (workerNodeKey: number): void {
    // Listen to worker messages.
    this.registerWorkerMessageListener(
      workerNodeKey,
      this.workerMessageListener
    )
    // Send the startup message to worker.
    this.sendStartupMessageToWorker(workerNodeKey)
    // Send the statistics message to worker.
    this.sendStatisticsMessageToWorker(workerNodeKey)
    if (this.opts.enableTasksQueue === true) {
      if (this.opts.tasksQueueOptions?.taskStealing === true) {
        this.workerNodes[workerNodeKey].on(
          'idleWorkerNode',
          this.handleIdleWorkerNodeEvent
        )
      }
      if (this.opts.tasksQueueOptions?.tasksStealingOnBackPressure === true) {
        this.workerNodes[workerNodeKey].on(
          'backPressure',
          this.handleBackPressureEvent
        )
      }
    }
    this.workerNodes[workerNodeKey].on('abortTask', this.abortTask)
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
      }
    })
  }

  private handleTask (workerNodeKey: number, task: Task<Data>): void {
    if (this.shallExecuteTask(workerNodeKey)) {
      this.executeTask(workerNodeKey, task)
    } else {
      this.enqueueTask(workerNodeKey, task)
    }
  }

  private redistributeQueuedTasks (workerNodeKey: number): void {
    if (workerNodeKey === -1) {
      return
    }
    if (this.workerNodes.length <= 1) {
      return
    }
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
      this.handleTask(
        destinationWorkerNodeKey,
        this.dequeueTask(workerNodeKey) as Task<Data>
      )
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

  private updateTaskSequentiallyStolenStatisticsWorkerUsage (
    workerNodeKey: number
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode?.usage != null) {
      ++workerNode.usage.tasks.sequentiallyStolen
    }
  }

  private updateTaskSequentiallyStolenStatisticsTaskFunctionWorkerUsage (
    workerNodeKey: number,
    taskName: string
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    if (
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      const taskFunctionWorkerUsage = workerNode.getTaskFunctionWorkerUsage(
        taskName
      ) as WorkerUsage
      ++taskFunctionWorkerUsage.tasks.sequentiallyStolen
    }
  }

  private resetTaskSequentiallyStolenStatisticsWorkerUsage (
    workerNodeKey: number
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode?.usage != null) {
      workerNode.usage.tasks.sequentiallyStolen = 0
    }
  }

  private resetTaskSequentiallyStolenStatisticsTaskFunctionWorkerUsage (
    workerNodeKey: number,
    taskName: string
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    if (
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      const taskFunctionWorkerUsage = workerNode.getTaskFunctionWorkerUsage(
        taskName
      ) as WorkerUsage
      taskFunctionWorkerUsage.tasks.sequentiallyStolen = 0
    }
  }

  private readonly handleIdleWorkerNodeEvent = (
    eventDetail: WorkerNodeEventDetail,
    previousStolenTask?: Task<Data>
  ): void => {
    if (this.workerNodes.length <= 1) {
      return
    }
    const { workerNodeKey } = eventDetail
    if (workerNodeKey == null) {
      throw new Error(
        'WorkerNode event detail workerNodeKey attribute must be defined'
      )
    }
    const workerNodeTasksUsage = this.workerNodes[workerNodeKey].usage.tasks
    if (
      previousStolenTask != null &&
      workerNodeTasksUsage.sequentiallyStolen > 0 &&
      (workerNodeTasksUsage.executing > 0 ||
        this.tasksQueueSize(workerNodeKey) > 0)
    ) {
      for (const taskName of this.workerNodes[workerNodeKey].info
        .taskFunctionNames as string[]) {
        this.resetTaskSequentiallyStolenStatisticsTaskFunctionWorkerUsage(
          workerNodeKey,
          taskName
        )
      }
      this.resetTaskSequentiallyStolenStatisticsWorkerUsage(workerNodeKey)
      return
    }
    const stolenTask = this.workerNodeStealTask(workerNodeKey)
    if (
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      stolenTask != null
    ) {
      const taskFunctionTasksWorkerUsage = this.workerNodes[
        workerNodeKey
      ].getTaskFunctionWorkerUsage(stolenTask.name as string)
        ?.tasks as TaskStatistics
      if (
        taskFunctionTasksWorkerUsage.sequentiallyStolen === 0 ||
        (previousStolenTask != null &&
          previousStolenTask.name === stolenTask.name &&
          taskFunctionTasksWorkerUsage.sequentiallyStolen > 0)
      ) {
        this.updateTaskSequentiallyStolenStatisticsTaskFunctionWorkerUsage(
          workerNodeKey,
          stolenTask.name as string
        )
      } else {
        this.resetTaskSequentiallyStolenStatisticsTaskFunctionWorkerUsage(
          workerNodeKey,
          stolenTask.name as string
        )
      }
    }
    sleep(exponentialDelay(workerNodeTasksUsage.sequentiallyStolen))
      .then(() => {
        this.handleIdleWorkerNodeEvent(eventDetail, stolenTask)
        return undefined
      })
      .catch(EMPTY_FUNCTION)
  }

  private readonly workerNodeStealTask = (
    workerNodeKey: number
  ): Task<Data> | undefined => {
    const workerNodes = this.workerNodes
      .slice()
      .sort(
        (workerNodeA, workerNodeB) =>
          workerNodeB.usage.tasks.queued - workerNodeA.usage.tasks.queued
      )
    const sourceWorkerNode = workerNodes.find(
      (sourceWorkerNode, sourceWorkerNodeKey) =>
        sourceWorkerNode.info.ready &&
        sourceWorkerNodeKey !== workerNodeKey &&
        sourceWorkerNode.usage.tasks.queued > 0
    )
    if (sourceWorkerNode != null) {
      const task = sourceWorkerNode.popTask() as Task<Data>
      this.handleTask(workerNodeKey, task)
      this.updateTaskSequentiallyStolenStatisticsWorkerUsage(workerNodeKey)
      this.updateTaskStolenStatisticsWorkerUsage(
        workerNodeKey,
        task.name as string
      )
      return task
    }
  }

  private readonly handleBackPressureEvent = (
    eventDetail: WorkerNodeEventDetail
  ): void => {
    if (this.workerNodes.length <= 1) {
      return
    }
    const { workerId } = eventDetail
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
        const task = sourceWorkerNode.popTask() as Task<Data>
        this.handleTask(workerNodeKey, task)
        this.updateTaskStolenStatisticsWorkerUsage(
          workerNodeKey,
          task.name as string
        )
      }
    }
  }

  /**
   * This method is the message listener registered on each worker.
   */
  protected readonly workerMessageListener = (
    message: MessageValue<Response>
  ): void => {
    this.checkMessageWorkerId(message)
    const { workerId, ready, taskId, taskFunctionNames } = message
    if (ready != null && taskFunctionNames != null) {
      // Worker ready response received from worker
      this.handleWorkerReadyResponse(message)
    } else if (taskId != null) {
      // Task execution response received from worker
      this.handleTaskExecutionResponse(message)
    } else if (taskFunctionNames != null) {
      // Task function names message received from worker
      this.getWorkerInfo(
        this.getWorkerNodeKeyByWorkerId(workerId)
      ).taskFunctionNames = taskFunctionNames
    }
  }

  private handleWorkerReadyResponse (message: MessageValue<Response>): void {
    const { workerId, ready, taskFunctionNames } = message
    if (ready === false) {
      throw new Error(`Worker ${workerId as number} failed to initialize`)
    }
    const workerInfo = this.getWorkerInfo(
      this.getWorkerNodeKeyByWorkerId(workerId)
    )
    workerInfo.ready = ready as boolean
    workerInfo.taskFunctionNames = taskFunctionNames
    if (!this.readyEventEmitted && this.ready) {
      this.readyEventEmitted = true
      this.emitter?.emit(PoolEvents.ready, this.info)
    }
  }

  private handleTaskExecutionResponse (message: MessageValue<Response>): void {
    const { workerId, taskId, workerError, data } = message
    const promiseResponse = this.promiseResponseMap.get(taskId as string)
    if (promiseResponse != null) {
      const { resolve, reject, workerNodeKey, asyncResource } = promiseResponse
      const workerNode = this.workerNodes[workerNodeKey]
      if (workerError != null) {
        this.emitter?.emit(PoolEvents.taskError, workerError)
        asyncResource != null
          ? asyncResource.runInAsyncScope(
            reject,
            this.emitter,
            workerError.message
          )
          : reject(workerError.message)
      } else {
        asyncResource != null
          ? asyncResource.runInAsyncScope(resolve, this.emitter, data)
          : resolve(data as Response)
      }
      asyncResource?.emitDestroy()
      this.afterTaskExecutionHook(workerNodeKey, message)
      this.promiseResponseMap.delete(taskId as string)
      workerNode?.emit('taskFinished', taskId)
      if (this.opts.enableTasksQueue === true && !this.destroying) {
        const workerNodeTasksUsage = workerNode.usage.tasks
        if (
          this.tasksQueueSize(workerNodeKey) > 0 &&
          workerNodeTasksUsage.executing <
            (this.opts.tasksQueueOptions?.concurrency as number)
        ) {
          this.executeTask(
            workerNodeKey,
            this.dequeueTask(workerNodeKey) as Task<Data>
          )
        }
        if (
          workerNodeTasksUsage.executing === 0 &&
          this.tasksQueueSize(workerNodeKey) === 0 &&
          workerNodeTasksUsage.sequentiallyStolen === 0
        ) {
          workerNode.emit('idleWorkerNode', {
            workerId: workerId as number,
            workerNodeKey
          })
        }
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

  /**
   * Emits dynamic worker creation events.
   */
  protected abstract checkAndEmitDynamicWorkerCreationEvents (): void

  /**
   * Gets the worker information given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @returns The worker information.
   */
  protected getWorkerInfo (workerNodeKey: number): WorkerInfo {
    return this.workerNodes[workerNodeKey]?.info
  }

  /**
   * Creates a worker node.
   *
   * @returns The created worker node.
   */
  private createWorkerNode (): IWorkerNode<Worker, Data> {
    const workerNode = new WorkerNode<Worker, Data>(
      this.worker,
      this.filePath,
      {
        env: this.opts.env,
        workerOptions: this.opts.workerOptions,
        tasksQueueBackPressureSize:
          this.opts.tasksQueueOptions?.size ??
          getDefaultTasksQueueOptions(
            this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
          ).size
      }
    )
    // Flag the worker node as ready at pool startup.
    if (this.starting) {
      workerNode.info.ready = true
    }
    return workerNode
  }

  /**
   * Adds the given worker node in the pool worker nodes.
   *
   * @param workerNode - The worker node.
   * @returns The added worker node key.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the added worker node is not found.
   */
  private addWorkerNode (workerNode: IWorkerNode<Worker, Data>): number {
    this.workerNodes.push(workerNode)
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey === -1) {
      throw new Error('Worker added not found in worker nodes')
    }
    return workerNodeKey
  }

  /**
   * Removes the worker node from the pool worker nodes.
   *
   * @param workerNode - The worker node.
   */
  private removeWorkerNode (workerNode: IWorkerNode<Worker, Data>): void {
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey !== -1) {
      this.workerNodes.splice(workerNodeKey, 1)
      this.workerChoiceStrategyContext.remove(workerNodeKey)
    }
  }

  protected flagWorkerNodeAsNotReady (workerNodeKey: number): void {
    this.getWorkerInfo(workerNodeKey).ready = false
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
    const { taskId, transferList } = task
    const { reject, abortSignal } = this.promiseResponseMap.get(
      taskId as string
    ) as PromiseResponseWrapper<Response>
    if (abortSignal?.aborted === true) {
      reject(new Error('Cannot execute an already aborted task'))
      return
    }
    this.beforeTaskExecutionHook(workerNodeKey, task)
    this.sendToWorker(workerNodeKey, task, transferList)
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

  protected flushTasksQueue (workerNodeKey: number): number {
    let flushedTasks = 0
    while (this.tasksQueueSize(workerNodeKey) > 0) {
      this.executeTask(
        workerNodeKey,
        this.dequeueTask(workerNodeKey) as Task<Data>
      )
      ++flushedTasks
    }
    this.workerNodes[workerNodeKey].clearTasksQueue()
    return flushedTasks
  }

  private flushTasksQueues (): void {
    for (const [workerNodeKey] of this.workerNodes.entries()) {
      this.flushTasksQueue(workerNodeKey)
    }
  }
}
