import type { UUID } from 'node:crypto'
import type { MessagePort, Transferable } from 'node:worker_threads'

import { AsyncResource } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { EventEmitterAsyncResource } from 'node:events'
import { performance } from 'node:perf_hooks'
import { receiveMessageOnPort } from 'node:worker_threads'

import type {
  MessageValue,
  PromiseResponseWrapper,
  Task,
  TaskFunctionProperties,
  WorkerError,
} from '../utility-types.js'
import type {
  TaskFunction,
  TaskFunctionObject,
} from '../worker/task-functions.js'
import type {
  IWorker,
  IWorkerNode,
  WorkerInfo,
  WorkerNodeEventDetail,
  WorkerType,
} from './worker.js'

import { defaultBucketSize } from '../queues/queue-types.js'
import {
  average,
  buildTaskFunctionProperties,
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  exponentialDelay,
  isKillBehavior,
  isPlainObject,
  max,
  median,
  min,
  round,
  sleep,
} from '../utils.js'
import { KillBehaviors } from '../worker/worker-options.js'
import {
  type IPool,
  PoolEvents,
  type PoolInfo,
  type PoolOptions,
  type PoolType,
  PoolTypes,
  type TasksQueueOptions,
} from './pool.js'
import {
  Measurements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies/selection-strategies-types.js'
import { WorkerChoiceStrategiesContext } from './selection-strategies/worker-choice-strategies-context.js'
import {
  checkFilePath,
  checkValidPriority,
  checkValidTasksQueueOptions,
  checkValidWorkerChoiceStrategy,
  checkValidWorkerNodeKeys,
  getDefaultTasksQueueOptions,
  updateEluWorkerUsage,
  updateRunTimeWorkerUsage,
  updateTaskStatisticsWorkerUsage,
  updateWaitTimeWorkerUsage,
  waitWorkerNodeEvents,
} from './utils.js'
import { version } from './version.js'
import { WorkerNode } from './worker-node.js'

/**
 * Base class that implements some shared logic for all poolifier pools.
 * @template Worker - Type of worker which manages this pool.
 * @template Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @template Response - Type of execution response. This can only be structured-cloneable data.
 */
export abstract class AbstractPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IPool<Worker, Data, Response> {
  /** @inheritDoc */
  public emitter?: EventEmitterAsyncResource

  /** @inheritDoc */
  public readonly workerNodes: IWorkerNode<Worker, Data>[] = []

  /** @inheritDoc */
  public get info (): PoolInfo {
    const taskStatisticsRequirements =
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      defaultStrategy: this.opts.workerChoiceStrategy!,
      maxSize: this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
      minSize: this.minimumNumberOfWorkers,
      ready: this.ready,
      started: this.started,
      strategyRetries:
        this.workerChoiceStrategiesContext?.getStrategyRetries() ?? 0,
      type: this.type,
      version,
      worker: this.worker,
      ...(taskStatisticsRequirements?.runTime.aggregate === true &&
        taskStatisticsRequirements.waitTime.aggregate && {
        utilization: round(this.utilization),
      }),
      busyWorkerNodes: this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
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
      failedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.failed,
        0
      ),
      idleWorkerNodes: this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeIdle(workerNodeKey) ? accumulator + 1 : accumulator,
        0
      ),
      workerNodes: this.workerNodes.length,
      ...(this.type === PoolTypes.dynamic && {
        dynamicWorkerNodes: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            workerNode.info.dynamic ? accumulator + 1 : accumulator,
          0
        ),
      }),
      ...(this.opts.enableTasksQueue === true && {
        backPressure: this.backPressure,
        backPressureWorkerNodes: this.workerNodes.reduce(
          (accumulator, _, workerNodeKey) =>
            this.isWorkerNodeBackPressured(workerNodeKey)
              ? accumulator + 1
              : accumulator,
          0
        ),
        maxQueuedTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + (workerNode.usage.tasks.maxQueued ?? 0),
          0
        ),
        queuedTasks: this.getQueuedTasks(),
        stealingWorkerNodes: this.getStealingWorkerNodes(),
        stolenTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + workerNode.usage.tasks.stolen,
          0
        ),
      }),
      ...(taskStatisticsRequirements?.runTime.aggregate === true && {
        runTime: {
          maximum: round(
            max(
              ...this.workerNodes.map(
                workerNode =>
                  workerNode.usage.runTime.maximum ?? Number.NEGATIVE_INFINITY
              )
            )
          ),
          minimum: round(
            min(
              ...this.workerNodes.map(
                workerNode =>
                  workerNode.usage.runTime.minimum ?? Number.POSITIVE_INFINITY
              )
            )
          ),
          ...(taskStatisticsRequirements.runTime.average && {
            average: round(
              average(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(
                      workerNode.usage.runTime.history.toArray()
                    ),
                  []
                )
              )
            ),
          }),
          ...(taskStatisticsRequirements.runTime.median && {
            median: round(
              median(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(
                      workerNode.usage.runTime.history.toArray()
                    ),
                  []
                )
              )
            ),
          }),
        },
      }),
      ...(taskStatisticsRequirements?.waitTime.aggregate === true && {
        waitTime: {
          maximum: round(
            max(
              ...this.workerNodes.map(
                workerNode =>
                  workerNode.usage.waitTime.maximum ?? Number.NEGATIVE_INFINITY
              )
            )
          ),
          minimum: round(
            min(
              ...this.workerNodes.map(
                workerNode =>
                  workerNode.usage.waitTime.minimum ?? Number.POSITIVE_INFINITY
              )
            )
          ),
          ...(taskStatisticsRequirements.waitTime.average && {
            average: round(
              average(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(
                      workerNode.usage.waitTime.history.toArray()
                    ),
                  []
                )
              )
            ),
          }),
          ...(taskStatisticsRequirements.waitTime.median && {
            median: round(
              median(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(
                      workerNode.usage.waitTime.history.toArray()
                    ),
                  []
                )
              )
            ),
          }),
        },
      }),
      ...(taskStatisticsRequirements?.elu.aggregate === true && {
        elu: {
          active: {
            maximum: round(
              max(
                ...this.workerNodes.map(
                  workerNode =>
                    workerNode.usage.elu.active.maximum ??
                    Number.NEGATIVE_INFINITY
                )
              )
            ),
            minimum: round(
              min(
                ...this.workerNodes.map(
                  workerNode =>
                    workerNode.usage.elu.active.minimum ??
                    Number.POSITIVE_INFINITY
                )
              )
            ),
            ...(taskStatisticsRequirements.elu.average && {
              average: round(
                average(
                  this.workerNodes.reduce<number[]>(
                    (accumulator, workerNode) =>
                      accumulator.concat(
                        workerNode.usage.elu.active.history.toArray()
                      ),
                    []
                  )
                )
              ),
            }),
            ...(taskStatisticsRequirements.elu.median && {
              median: round(
                median(
                  this.workerNodes.reduce<number[]>(
                    (accumulator, workerNode) =>
                      accumulator.concat(
                        workerNode.usage.elu.active.history.toArray()
                      ),
                    []
                  )
                )
              ),
            }),
          },
          idle: {
            maximum: round(
              max(
                ...this.workerNodes.map(
                  workerNode =>
                    workerNode.usage.elu.idle.maximum ??
                    Number.NEGATIVE_INFINITY
                )
              )
            ),
            minimum: round(
              min(
                ...this.workerNodes.map(
                  workerNode =>
                    workerNode.usage.elu.idle.minimum ??
                    Number.POSITIVE_INFINITY
                )
              )
            ),
            ...(taskStatisticsRequirements.elu.average && {
              average: round(
                average(
                  this.workerNodes.reduce<number[]>(
                    (accumulator, workerNode) =>
                      accumulator.concat(
                        workerNode.usage.elu.idle.history.toArray()
                      ),
                    []
                  )
                )
              ),
            }),
            ...(taskStatisticsRequirements.elu.median && {
              median: round(
                median(
                  this.workerNodes.reduce<number[]>(
                    (accumulator, workerNode) =>
                      accumulator.concat(
                        workerNode.usage.elu.idle.history.toArray()
                      ),
                    []
                  )
                )
              ),
            }),
          },
          utilization: {
            average: round(
              average(
                this.workerNodes.map(
                  workerNode => workerNode.usage.elu.utilization ?? 0
                )
              )
            ),
            median: round(
              median(
                this.workerNodes.map(
                  workerNode => workerNode.usage.elu.utilization ?? 0
                )
              )
            ),
          },
        },
      }),
    }
  }

  /**
   * Whether the pool is destroying or not.
   */
  protected destroying: boolean

  /**
   * The task execution response promise map:
   * - `key`: The message id of each submitted task.
   * - `value`: An object that contains task's worker node key, execution response promise resolve and reject callbacks, async resource.
   *
   * When we receive a message from the worker, we get a map entry with the promise resolve/reject bound to the message id.
   */
  protected promiseResponseMap: Map<UUID, PromiseResponseWrapper<Response>> =
    new Map<UUID, PromiseResponseWrapper<Response>>()

  /**
   * Whether the pool is started or not.
   */
  protected started: boolean

  /**
   * Whether the pool is starting or not.
   */
  protected starting: boolean

  /**
   * Worker choice strategies context referencing worker choice algorithms implementation.
   */
  protected workerChoiceStrategiesContext?: WorkerChoiceStrategiesContext<
    Worker,
    Data,
    Response
  >

  /**
   * Whether the pool is back pressured or not.
   * @returns The pool back pressure boolean status.
   */
  protected abstract get backPressure (): boolean

  /**
   * Whether the pool is busy or not.
   * @returns The pool busyness boolean status.
   */
  protected abstract get busy (): boolean

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
   * Whether the pool back pressure event has been emitted or not.
   */
  private backPressureEventEmitted: boolean

  /**
   * Whether the pool busy event has been emitted or not.
   */
  private busyEventEmitted: boolean

  /**
   * The last explicit default acknowledged by an operation's worker cohort.
   */
  private defaultTaskFunctionName?: string

  private pendingTaskFunctionOperations = 0

  /**
   * Whether the pool ready event has been emitted or not.
   */
  private readyEventEmitted: boolean

  private resolveTaskFunctionOperations?: (value: undefined) => void

  /**
   * Whether the minimum number of workers is starting or not.
   */
  private startingMinimumNumberOfWorkers: boolean

  /**
   * The start timestamp of the pool.
   */
  private startTimestamp?: number
  /**
   * Whether task dequeuing events are deferred until worker exit handoffs finish.
   */
  private taskDequeuingEventsDeferred = false
  private taskFunctionOperationsFinished?: Promise<undefined>
  /**
   * The task functions added at runtime map:
   * - `key`: The task function name.
   * - `value`: The task function object.
   */
  private readonly taskFunctions: Map<
    string,
    TaskFunctionObject<Data, Response>
  >

  /**
   * Worker nodes whose termination was requested by the pool.
   */
  private readonly terminatingWorkerNodes = new WeakSet<
    IWorkerNode<Worker, Data>
  >()

  private readonly workerTaskFunctionBootstraps = new Map<
    IWorkerNode<Worker, Data>,
    { promise?: Promise<void>; ready: boolean }
  >()

  private readonly workerTaskFunctionOperationExitListeners = new Map<
    IWorkerNode<Worker, Data>,
    Set<() => void>
  >()

  /**
   * Whether the pool is ready or not.
   * @returns The pool readiness boolean status.
   */
  private get ready (): boolean {
    if (!this.started) {
      return false
    }
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
   * @returns The pool utilization.
   */
  private get utilization (): number {
    if (this.startTimestamp == null) {
      return 0
    }
    const poolTimeCapacity =
      (performance.now() - this.startTimestamp) *
      (this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers)
    if (!Number.isFinite(poolTimeCapacity) || poolTimeCapacity <= 0) {
      return 0
    }
    const totalTasksRunTime = this.workerNodes.reduce(
      (accumulator, workerNode) =>
        accumulator + (workerNode.usage.runTime.aggregate ?? 0),
      0
    )
    const totalTasksWaitTime = this.workerNodes.reduce(
      (accumulator, workerNode) =>
        accumulator + (workerNode.usage.waitTime.aggregate ?? 0),
      0
    )
    return (totalTasksRunTime + totalTasksWaitTime) / poolTimeCapacity
  }

  /**
   * Constructs a new poolifier pool.
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
      this.initEventEmitter()
    }
    this.workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext<
      Worker,
      Data,
      Response
    >(
      this,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      [this.opts.workerChoiceStrategy!],
      this.opts.workerChoiceStrategyOptions
    )

    this.setupHook()

    this.taskFunctions = new Map<string, TaskFunctionObject<Data, Response>>()

    this.started = false
    this.starting = false
    this.destroying = false
    this.readyEventEmitted = false
    this.busyEventEmitted = false
    this.backPressureEventEmitted = false
    this.startingMinimumNumberOfWorkers = false
    if (this.opts.startWorkers === true) {
      this.start()
    }
  }

  /** @inheritDoc */
  public async addTaskFunction (
    name: string,
    fn: TaskFunction<Data, Response> | TaskFunctionObject<Data, Response>
  ): Promise<boolean> {
    if (typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (typeof fn === 'function') {
      fn = { taskFunction: fn } satisfies TaskFunctionObject<Data, Response>
    }
    if (typeof fn.taskFunction !== 'function') {
      throw new TypeError('taskFunction property must be a function')
    }
    checkValidPriority(fn.priority)
    checkValidWorkerChoiceStrategy(fn.strategy)
    checkValidWorkerNodeKeys(
      fn.workerNodeKeys,
      this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
    )
    if (this.workerTaskFunctionBootstraps.size > 0) {
      await this.waitForWorkerTaskFunctionBootstraps()
    }
    this.beginTaskFunctionOperation()
    try {
      const opResult = await this.sendTaskFunctionOperationToWorkers({
        taskFunction: fn.taskFunction.toString(),
        taskFunctionOperation: 'add',
        taskFunctionProperties: buildTaskFunctionProperties(name, fn),
      })
      this.taskFunctions.set(name, fn)
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        this.getWorkerChoiceStrategies()
      )
      for (const workerNodeKey of this.workerNodes.keys()) {
        this.sendStatisticsMessageToWorker(workerNodeKey)
      }
      return opResult
    } finally {
      this.endTaskFunctionOperation()
    }
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
    try {
      await Promise.allSettled(
        this.workerNodes.map(async (_, workerNodeKey) => {
          try {
            await this.destroyWorkerNode(workerNodeKey)
          } catch (error) {
            this.emitter?.emit(PoolEvents.error, error)
          }
        })
      )
    } finally {
      delete this.startTimestamp
      this.destroying = false
      this.started = false
      if (this.emitter != null) {
        this.emitter.listenerCount(PoolEvents.destroy) > 0 &&
          this.emitter.emit(PoolEvents.destroy, this.info)
        this.emitter.emitDestroy()
        this.readyEventEmitted = false
      }
    }
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
    this.setTasksQueueOptions(tasksQueueOptions)
  }

  /** @inheritDoc */
  public async execute (
    data?: Data,
    name?: string,
    abortSignal?: AbortSignal,
    transferList?: readonly Transferable[]
  ): Promise<Response> {
    if (!this.started) {
      throw new Error('Cannot execute a task on not started pool')
    }
    if (this.destroying) {
      throw new Error('Cannot execute a task on destroying pool')
    }
    if (name != null && typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (name != null && typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (abortSignal != null && !(abortSignal instanceof AbortSignal)) {
      throw new TypeError('abortSignal argument must be an AbortSignal')
    }
    if (transferList != null && !Array.isArray(transferList)) {
      throw new TypeError('transferList argument must be an array')
    }
    transferList =
      transferList != null && transferList.length > 0
        ? Array.from(transferList)
        : undefined
    return await this.internalExecute(data, name, abortSignal, transferList)
  }

  /** @inheritDoc */
  public hasTaskFunction (name: string): boolean {
    return this.listTaskFunctionsProperties().some(
      taskFunctionProperties => taskFunctionProperties.name === name
    )
  }

  /** @inheritDoc */
  public listTaskFunctionsProperties (): TaskFunctionProperties[] {
    for (const workerNode of this.workerNodes) {
      if (
        Array.isArray(workerNode.info.taskFunctionsProperties) &&
        workerNode.info.taskFunctionsProperties.length > 0
      ) {
        return workerNode.info.taskFunctionsProperties
      }
    }
    return []
  }

  /** @inheritDoc */
  public async mapExecute (
    data: Iterable<Data>,
    name?: string,
    abortSignals?: Iterable<AbortSignal>,
    transferList?: readonly Transferable[]
  ): Promise<Response[]> {
    if (!this.started) {
      throw new Error('Cannot execute task(s) on not started pool')
    }
    if (this.destroying) {
      throw new Error('Cannot execute task(s) on destroying pool')
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (data == null) {
      throw new TypeError('data argument must be a defined iterable')
    }
    if (typeof data[Symbol.iterator] !== 'function') {
      throw new TypeError('data argument must be an iterable')
    }
    if (name != null && typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (name != null && typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (!Array.isArray(data)) {
      data = [...data]
    }
    if (abortSignals != null) {
      if (typeof abortSignals[Symbol.iterator] !== 'function') {
        throw new TypeError('abortSignals argument must be an iterable')
      }
      if (!Array.isArray(abortSignals)) {
        abortSignals = [...abortSignals]
      }
      for (const abortSignal of abortSignals) {
        if (!(abortSignal instanceof AbortSignal)) {
          throw new TypeError(
            'abortSignals argument must be an iterable of AbortSignal'
          )
        }
      }
      if ((data as Data[]).length !== (abortSignals as AbortSignal[]).length) {
        throw new Error(
          'data and abortSignals arguments must have the same length'
        )
      }
    }
    if (transferList != null && !Array.isArray(transferList)) {
      throw new TypeError('transferList argument must be an array')
    }
    transferList =
      transferList != null && transferList.length > 0
        ? Array.from(transferList)
        : undefined
    const tasks: [Data, AbortSignal | undefined][] = Array.from(
      { length: (data as Data[]).length },
      (_, i) => [
        (data as Data[])[i],
        abortSignals != null ? (abortSignals as AbortSignal[])[i] : undefined,
      ]
    )
    return await Promise.all(
      tasks.map(([data, abortSignal]) =>
        this.internalExecute(data, name, abortSignal, transferList)
      )
    )
  }

  /** @inheritDoc */
  public async removeTaskFunction (name: string): Promise<boolean> {
    if (!this.taskFunctions.has(name)) {
      throw new Error(
        'Cannot remove a task function not handled on the pool side'
      )
    }
    if (this.workerTaskFunctionBootstraps.size > 0) {
      await this.waitForWorkerTaskFunctionBootstraps()
    }
    this.beginTaskFunctionOperation()
    try {
      const opResult = await this.sendTaskFunctionOperationToWorkers({
        taskFunctionOperation: 'remove',
        taskFunctionProperties: buildTaskFunctionProperties(
          name,
          this.taskFunctions.get(name)
        ),
      })
      for (const workerNode of this.workerNodes) {
        workerNode.deleteTaskFunctionWorkerUsage(name)
      }
      this.taskFunctions.delete(name)
      if (this.defaultTaskFunctionName === name) {
        this.defaultTaskFunctionName = undefined
      }
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        this.getWorkerChoiceStrategies()
      )
      for (const workerNodeKey of this.workerNodes.keys()) {
        this.sendStatisticsMessageToWorker(workerNodeKey)
      }
      return opResult
    } finally {
      this.endTaskFunctionOperation()
    }
  }

  /** @inheritDoc */
  public async setDefaultTaskFunction (name: string): Promise<boolean> {
    if (this.workerTaskFunctionBootstraps.size > 0) {
      await this.waitForWorkerTaskFunctionBootstraps()
    }
    this.beginTaskFunctionOperation()
    try {
      const hadTargets = this.workerNodes.length > 0
      const opResult = await this.sendTaskFunctionOperationToWorkers({
        taskFunctionOperation: 'default',
        taskFunctionProperties: buildTaskFunctionProperties(
          name,
          this.taskFunctions.get(name)
        ),
      })
      if (hadTargets) this.defaultTaskFunctionName = name
      return opResult
    } finally {
      this.endTaskFunctionOperation()
    }
  }

  /** @inheritDoc */
  public setTasksQueueOptions (
    tasksQueueOptions: TasksQueueOptions | undefined
  ): void {
    if (this.opts.enableTasksQueue === true) {
      checkValidTasksQueueOptions(tasksQueueOptions)
      this.opts.tasksQueueOptions =
        this.buildTasksQueueOptions(tasksQueueOptions)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.setTasksQueueSize(this.opts.tasksQueueOptions.size!)
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

  /** @inheritDoc */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy,
    workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  ): void {
    let requireSync = false
    checkValidWorkerChoiceStrategy(workerChoiceStrategy)
    if (workerChoiceStrategyOptions != null) {
      requireSync = !this.setWorkerChoiceStrategyOptions(
        workerChoiceStrategyOptions
      )
    }
    if (workerChoiceStrategy !== this.opts.workerChoiceStrategy) {
      this.opts.workerChoiceStrategy = workerChoiceStrategy
      this.workerChoiceStrategiesContext?.setDefaultWorkerChoiceStrategy(
        this.opts.workerChoiceStrategy,
        this.opts.workerChoiceStrategyOptions
      )
      requireSync = true
    }
    if (requireSync) {
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        this.getWorkerChoiceStrategies(),
        this.opts.workerChoiceStrategyOptions
      )
      for (const workerNodeKey of this.workerNodes.keys()) {
        this.sendStatisticsMessageToWorker(workerNodeKey)
      }
    }
  }

  /** @inheritDoc */
  public setWorkerChoiceStrategyOptions (
    workerChoiceStrategyOptions: undefined | WorkerChoiceStrategyOptions
  ): boolean {
    this.checkValidWorkerChoiceStrategyOptions(workerChoiceStrategyOptions)
    if (workerChoiceStrategyOptions != null) {
      this.opts.workerChoiceStrategyOptions = {
        ...this.opts.workerChoiceStrategyOptions,
        ...workerChoiceStrategyOptions,
      }
      this.workerChoiceStrategiesContext?.setOptions(
        this.opts.workerChoiceStrategyOptions
      )
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        this.getWorkerChoiceStrategies(),
        this.opts.workerChoiceStrategyOptions
      )
      for (const workerNodeKey of this.workerNodes.keys()) {
        this.sendStatisticsMessageToWorker(workerNodeKey)
      }
      return true
    }
    return false
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
    try {
      this.startMinimumNumberOfWorkers()
      this.startTimestamp = performance.now()
    } finally {
      this.starting = false
    }
    this.started = true
  }

  /**
   * Hook executed after task execution for a live worker node.
   * Recovered responses from removed worker nodes do not invoke this hook.
   * Can be overridden.
   * @param workerNodeKey - The live worker node key.
   * @param message - The received message.
   */
  protected afterTaskExecutionHook (
    workerNodeKey: number,
    message: MessageValue<Response>
  ): void {
    let needWorkerChoiceStrategiesUpdate = false
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.workerNodes[workerNodeKey]?.usage != null) {
      const workerUsage = this.workerNodes[workerNodeKey].usage
      updateTaskStatisticsWorkerUsage(workerUsage, message)
      updateRunTimeWorkerUsage(
        this.workerChoiceStrategiesContext,
        workerUsage,
        message
      )
      updateEluWorkerUsage(
        this.workerChoiceStrategiesContext,
        workerUsage,
        message
      )
      needWorkerChoiceStrategiesUpdate = true
    }
    if (
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey)
      ) &&
      message.taskPerformance?.name != null &&
      this.workerNodes[workerNodeKey].getTaskFunctionWorkerUsage(
        message.taskPerformance.name
      ) != null
    ) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const taskFunctionWorkerUsage = this.workerNodes[
        workerNodeKey
      ].getTaskFunctionWorkerUsage(message.taskPerformance.name)!
      updateTaskStatisticsWorkerUsage(taskFunctionWorkerUsage, message)
      updateRunTimeWorkerUsage(
        this.workerChoiceStrategiesContext,
        taskFunctionWorkerUsage,
        message
      )
      updateEluWorkerUsage(
        this.workerChoiceStrategiesContext,
        taskFunctionWorkerUsage,
        message
      )
      needWorkerChoiceStrategiesUpdate = true
    }
    if (needWorkerChoiceStrategiesUpdate) {
      this.workerChoiceStrategiesContext?.update(workerNodeKey)
    }
  }

  /**
   * Method hooked up after a worker node has been newly created.
   * Can be overridden.
   * @param workerNodeKey - The newly created worker node key.
   */
  protected afterWorkerNodeSetup (workerNodeKey: number): void {
    // Listen to worker messages.
    this.registerWorkerLifecycleMessageListener(
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
          'idle',
          this.handleWorkerNodeIdleEvent
        )
      }
      if (this.opts.tasksQueueOptions?.tasksStealingOnBackPressure === true) {
        this.workerNodes[workerNodeKey].on(
          'backPressure',
          this.handleWorkerNodeBackPressureEvent
        )
      }
    }
    this.workerNodes[workerNodeKey].on('abortTask', this.abortTask)
  }

  /**
   * Hook executed before the worker task execution.
   * Can be overridden.
   * @param workerNodeKey - The worker node key.
   * @param task - The task to execute.
   */
  protected beforeTaskExecutionHook (
    workerNodeKey: number,
    task: Task<Data>
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.workerNodes[workerNodeKey]?.usage != null) {
      const workerUsage = this.workerNodes[workerNodeKey].usage
      ++workerUsage.tasks.executing
      updateWaitTimeWorkerUsage(
        this.workerChoiceStrategiesContext,
        workerUsage,
        task
      )
    }
    if (
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey)
      ) &&
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.workerNodes[workerNodeKey].getTaskFunctionWorkerUsage(task.name!) !=
        null
    ) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const taskFunctionWorkerUsage = this.workerNodes[
        workerNodeKey
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ].getTaskFunctionWorkerUsage(task.name!)!
      ++taskFunctionWorkerUsage.tasks.executing
      updateWaitTimeWorkerUsage(
        this.workerChoiceStrategiesContext,
        taskFunctionWorkerUsage,
        task
      )
    }
  }

  /**
   * Emits dynamic worker creation events.
   */
  protected abstract checkAndEmitDynamicWorkerCreationEvents (): void

  /**
   * Emits dynamic worker destruction events.
   */
  protected abstract checkAndEmitDynamicWorkerDestructionEvents (): void

  /**
   * Creates a new, completely set up dynamic worker node.
   * @returns New, completely set up dynamic worker node key.
   */
  protected createAndSetupDynamicWorkerNode (): number {
    const workerNodeKey = this.createAndSetupWorkerNode()
    this.registerWorkerLifecycleMessageListener(workerNodeKey, message => {
      if (
        this.destroying ||
        message.kill === 'success' ||
        message.kill === 'failure' ||
        message.taskFunctionOperationStatus != null
      ) {
        return
      }
      this.checkMessageWorkerId(message)
      const localWorkerNodeKey = this.getWorkerNodeKeyByWorkerId(
        message.workerId
      )
      // Kill message received from worker
      if (
        isKillBehavior(KillBehaviors.HARD, message.kill) ||
        (isKillBehavior(KillBehaviors.SOFT, message.kill) &&
          this.isWorkerNodeIdle(localWorkerNodeKey) &&
          !this.isWorkerNodeStealing(localWorkerNodeKey))
      ) {
        this.destroyWorkerNode(localWorkerNodeKey).catch((error: unknown) => {
          this.emitter?.emit(PoolEvents.error, error)
        })
      }
    })
    this.sendToWorker(workerNodeKey, {
      checkActive: true,
    })
    const workerNode = this.workerNodes[workerNodeKey]
    workerNode.info.dynamic = true
    if (
      this.workerChoiceStrategiesContext?.getPolicy().dynamicWorkerReady ===
        true &&
      !this.workerTaskFunctionBootstraps.has(workerNode)
    ) {
      workerNode.info.ready = true
    }
    this.initWorkerNodeUsage(workerNode)
    this.checkAndEmitDynamicWorkerCreationEvents()
    return workerNodeKey
  }

  /**
   * Creates a new, completely set up worker node.
   * @returns New, completely set up worker node key.
   */
  protected createAndSetupWorkerNode (): number {
    const workerNode = this.createWorkerNode()
    const exitHandler = this.opts.exitHandler
    let workerError: Error | undefined
    let taskResponses: MessageValue<Response>[] | undefined
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
    workerNode.registerOnceWorkerEventHandler(
      'error',
      (rawWorkerError: unknown) => {
        workerError =
          rawWorkerError instanceof Error
            ? rawWorkerError
            : new Error(
              typeof rawWorkerError === 'string'
                ? rawWorkerError
                : 'Worker failed with a non-Error value',
              { cause: rawWorkerError }
            )
        taskResponses = this.captureTaskResponses(workerNode, taskResponses)
        workerNode.info.ready = false
        this.emitter?.emit(PoolEvents.error, rawWorkerError)
        if (this.started && !this.destroying) {
          if (this.opts.restartWorkerOnError === true) {
            if (workerNode.info.dynamic) {
              this.createAndSetupDynamicWorkerNode()
            } else if (!this.startingMinimumNumberOfWorkers) {
              this.startMinimumNumberOfWorkers(true)
            }
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        workerNode?.terminate().catch((error: unknown) => {
          this.emitter?.emit(PoolEvents.error, error)
        })
      }
    )
    workerNode.registerOnceWorkerEventHandler('exit', (exitCode: number) => {
      const taskDequeuingEventsDeferred = this.taskDequeuingEventsDeferred
      try {
        const operationExitListeners =
          this.workerTaskFunctionOperationExitListeners.get(workerNode)
        if (operationExitListeners != null) {
          this.workerTaskFunctionOperationExitListeners.delete(workerNode)
          // Settle in dispatch order before removal or fallible replacement setup.
          for (const listener of operationExitListeners) listener()
        }
        const settlingTasks =
          workerError != null || !this.terminatingWorkerNodes.has(workerNode)
        if (settlingTasks) {
          taskResponses = this.captureTaskResponses(workerNode, taskResponses)
        }
        workerNode.info.ready = false
        let workerNodeTasks:
          | Map<UUID, PromiseResponseWrapper<Response>>
          | undefined
        if (settlingTasks) {
          const workerNodeKey = this.workerNodes.indexOf(workerNode)
          for (const [taskId, promiseResponse] of this.promiseResponseMap) {
            if (promiseResponse.workerNodeKey === workerNodeKey) {
              ;(workerNodeTasks ??= new Map()).set(taskId, promiseResponse)
            }
          }
        }
        if (settlingTasks) {
          this.taskDequeuingEventsDeferred = true
        }
        this.removeWorkerNode(workerNode)
        try {
          if (
            this.started &&
            !this.startingMinimumNumberOfWorkers &&
            !this.destroying
          ) {
            this.startMinimumNumberOfWorkers(true)
          }
        } finally {
          try {
            if (settlingTasks) {
              this.redistributeQueuedTasks(workerNode)
            }
          } finally {
            if (settlingTasks) {
              workerNode.clearTasksQueue()
            }
            if (settlingTasks) {
              this.taskDequeuingEventsDeferred = taskDequeuingEventsDeferred
              this.checkAndEmitTaskDequeuingEvents()
            }
            if (taskResponses != null) {
              for (const message of taskResponses) {
                this.handleTaskExecutionResponse(message)
              }
            }
            if (workerNodeTasks != null) {
              this.rejectWorkerNodeTasks(workerNodeTasks, workerError)
            }
            this.checkAndEmitTaskExecutionFinishedEvents()
          }
        }
      } finally {
        this.taskDequeuingEventsDeferred = taskDequeuingEventsDeferred
        exitHandler?.call(workerNode.worker, exitCode)
      }
    })
    const workerNodeKey = this.addWorkerNode(workerNode)
    if (
      this.pendingTaskFunctionOperations > 0 ||
      this.taskFunctions.size > 0 ||
      this.defaultTaskFunctionName != null
    ) {
      const bootstrap: { promise?: Promise<void>; ready: boolean } = {
        ready: false,
      }
      workerNode.info.ready = false
      this.workerTaskFunctionBootstraps.set(workerNode, bootstrap)
      bootstrap.promise = this.replayTaskFunctionsAfterOperations(
        workerNode,
        bootstrap
      )
      bootstrap.promise.catch((error: unknown) => {
        this.emitter?.emit(PoolEvents.error, error)
      })
    }
    this.afterWorkerNodeSetup(workerNodeKey)
    return workerNodeKey
  }

  /**
   * Deregisters a listener callback on the worker given its worker node key.
   * @param workerNodeKey - The worker node key.
   * @param listener - The message listener callback.
   */
  protected abstract deregisterWorkerMessageListener<
    Message extends Data | Response
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void

  /**
   * Terminates the worker node given its worker node key.
   * @param workerNodeKey - The worker node key.
   */
  protected async destroyWorkerNode (workerNodeKey: number): Promise<void> {
    const workerNode = this.workerNodes[workerNodeKey]
    this.terminatingWorkerNodes.add(workerNode)
    this.flagWorkerNodeAsNotReady(workerNodeKey)
    const flushedTasks = this.flushTasksQueue(workerNodeKey)
    await waitWorkerNodeEvents(
      workerNode,
      'taskFinished',
      flushedTasks,
      this.opts.tasksQueueOptions?.tasksFinishedTimeout ??
        getDefaultTasksQueueOptions(
          this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
        ).tasksFinishedTimeout,
      false
    )
    try {
      const currentWorkerNodeKey = this.workerNodes.indexOf(workerNode)
      if (currentWorkerNodeKey !== -1) {
        await this.sendKillMessageToWorker(currentWorkerNodeKey)
      }
    } finally {
      await workerNode.terminate()
    }
  }

  protected flagWorkerNodeAsNotReady (workerNodeKey: number): void {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    if (workerInfo != null) {
      workerInfo.ready = false
    }
  }

  protected flushTasksQueue (workerNodeKey: number): number {
    let flushedTasks = 0
    while (this.tasksQueueSize(workerNodeKey) > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (this.executeTask(workerNodeKey, this.dequeueTask(workerNodeKey)!)) {
        ++flushedTasks
      }
    }
    this.workerNodes[workerNodeKey].clearTasksQueue()
    return flushedTasks
  }

  /**
   * Gets the worker information given its worker node key.
   * @param workerNodeKey - The worker node key.
   * @returns The worker information.
   */
  protected getWorkerInfo (workerNodeKey: number): undefined | WorkerInfo {
    return this.workerNodes[workerNodeKey]?.info
  }

  /**
   * Whether the worker nodes are back pressured or not.
   * @returns Worker nodes back pressure boolean status.
   */
  protected internalBackPressure (): boolean {
    if (this.workerNodes.length === 0) return false
    return (
      this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeBackPressured(workerNodeKey)
            ? accumulator + 1
            : accumulator,
        0
      ) === this.workerNodes.length
    )
  }

  /**
   * Whether worker nodes are executing concurrently their tasks quota or not.
   * @returns Worker nodes busyness boolean status.
   */
  protected internalBusy (): boolean {
    if (this.workerNodes.length === 0) return false
    return (
      this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeBusy(workerNodeKey) ? accumulator + 1 : accumulator,
        0
      ) === this.workerNodes.length
    )
  }

  /**
   * Returns whether the worker is the main worker or not.
   * @returns `true` if the worker is the main worker, `false` otherwise.
   */
  protected abstract isMain (): boolean

  /**
   * Registers once a listener callback on the worker given its worker node key.
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
   * Registers a listener callback on the worker given its worker node key.
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
   * Sends the startup message to worker given its worker node key.
   * @param workerNodeKey - The worker node key.
   */
  protected abstract sendStartupMessageToWorker (workerNodeKey: number): void

  /**
   * Sends a message to worker given its worker node key.
   * @param workerNodeKey - The worker node key.
   * @param message - The message.
   * @param transferList - The optional array of transferable objects.
   */
  protected abstract sendToWorker (
    workerNodeKey: number,
    message: MessageValue<Data>,
    transferList?: readonly Transferable[]
  ): void

  /**
   * Setup hook to execute code before worker nodes are created in the abstract constructor.
   * Can be overridden.
   */
  protected setupHook (): void {
    /* Intentionally empty */
  }

  /**
   * Conditions for dynamic worker creation.
   * @returns Whether to create a dynamic worker or not.
   */
  protected abstract shallCreateDynamicWorker (): boolean

  /**
   * This method is the message listener registered on each worker.
   * @param message - The message received from the worker.
   */
  protected readonly workerMessageListener = (
    message: MessageValue<Response>
  ): void => {
    const { kill, ready, taskFunctionsProperties, taskId, workerId } = message
    const workerReadyMessage = ready != null && taskFunctionsProperties != null
    // Late worker ready message received
    if (this.destroying && workerReadyMessage) {
      return
    }
    // Kill and task-function operation responses have dedicated listeners.
    if (kill != null || message.taskFunctionOperationStatus != null) {
      return
    }
    this.checkMessageWorkerId(message)
    if (workerReadyMessage) {
      // Worker ready response received from worker
      this.handleWorkerReadyResponse(message)
    } else if (taskFunctionsProperties != null) {
      // Task function properties message received from worker
      const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
      const workerInfo = this.getWorkerInfo(workerNodeKey)
      if (workerInfo != null) {
        workerInfo.taskFunctionsProperties = taskFunctionsProperties
        this.sendStatisticsMessageToWorker(workerNodeKey)
        this.setTasksQueuePriority(workerNodeKey)
      }
    } else if (taskId != null) {
      // Task execution response received from worker
      this.handleTaskExecutionResponse(message)
    }
  }

  private readonly abortTask = (eventDetail: WorkerNodeEventDetail): void => {
    if (!this.started) {
      return
    }
    const { taskId, workerId } = eventDetail
    if (taskId == null) {
      return
    }
    const promiseResponse = this.promiseResponseMap.get(taskId)
    if (promiseResponse == null) {
      return
    }
    const { abortSignal } = promiseResponse
    if (abortSignal?.aborted === false) {
      return
    }
    const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    const workerNode = this.workerNodes[workerNodeKey]
    if (!workerNode.info.ready) {
      return
    }
    if (this.opts.enableTasksQueue === true) {
      for (const task of workerNode.tasksQueue) {
        const { abortable, name } = task
        if (taskId === task.taskId && abortable === true) {
          workerNode.info.queuedTaskAbortion = true
          workerNode.deleteTask(task)
          workerNode.info.queuedTaskAbortion = false

          this.rejectTask(
            taskId,
            promiseResponse,
            this.getAbortError(name ?? DEFAULT_TASK_NAME, taskId, abortSignal)
          )
          return
        }
      }
    }
    this.sendToWorker(workerNodeKey, { taskId, taskOperation: 'abort' })
  }

  /**
   * Adds the given worker node in the pool worker nodes.
   * @param workerNode - The worker node.
   * @returns The added worker node key.
   * @throws {Error} If the added worker node is not found.
   */
  private addWorkerNode (workerNode: IWorkerNode<Worker, Data>): number {
    this.workerNodes.push(workerNode)
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey === -1) {
      throw new Error('Worker added not found in worker nodes')
    }
    return workerNodeKey
  }

  private beginTaskFunctionOperation (): void {
    if (this.pendingTaskFunctionOperations++ === 0) {
      const { promise, resolve } = Promise.withResolvers<undefined>()
      this.taskFunctionOperationsFinished = promise
      this.resolveTaskFunctionOperations = resolve
    }
  }

  private buildTasksQueueOptions (
    tasksQueueOptions: TasksQueueOptions | undefined
  ): TasksQueueOptions {
    return {
      ...getDefaultTasksQueueOptions(
        this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
      ),
      ...this.opts.tasksQueueOptions,
      ...tasksQueueOptions,
    }
  }

  private cannotStealTask (): boolean {
    return (
      !this.started ||
      this.destroying ||
      this.workerNodes.length <= 1 ||
      this.getQueuedTasks() === 0
    )
  }

  private captureTaskResponses (
    workerNode: IWorkerNode<Worker, Data>,
    taskResponses: MessageValue<Response>[] | undefined
  ): MessageValue<Response>[] | undefined {
    // Capture before termination closes the thread's private channel.
    while (workerNode.messageChannel != null) {
      const response = receiveMessageOnPort(workerNode.messageChannel.port1)
      if (response == null) {
        break
      }
      const message = response.message as MessageValue<Response>
      if (message.taskId != null) {
        this.checkMessageWorkerId(message)
        ;(taskResponses ??= []).push(message)
      }
    }
    return taskResponses
  }

  private checkAndEmitReadyEvent (): void {
    if (this.emitter != null && !this.readyEventEmitted && this.ready) {
      this.emitter.listenerCount(PoolEvents.ready) > 0 &&
        this.emitter.emit(PoolEvents.ready, this.info)
      this.readyEventEmitted = true
    }
  }

  private checkAndEmitTaskDequeuingEvents (): void {
    if (
      this.emitter != null &&
      this.backPressureEventEmitted &&
      !this.taskDequeuingEventsDeferred &&
      !this.backPressure
    ) {
      this.emitter.listenerCount(PoolEvents.backPressureEnd) > 0 &&
        this.emitter.emit(PoolEvents.backPressureEnd, this.info)
      this.backPressureEventEmitted = false
    }
  }

  private checkAndEmitTaskExecutionEvents (): void {
    if (this.emitter != null && !this.busyEventEmitted && this.busy) {
      this.emitter.listenerCount(PoolEvents.busy) > 0 &&
        this.emitter.emit(PoolEvents.busy, this.info)
      this.busyEventEmitted = true
    }
  }

  private checkAndEmitTaskExecutionFinishedEvents (): void {
    if (this.emitter != null && this.busyEventEmitted && !this.busy) {
      this.emitter.listenerCount(PoolEvents.busyEnd) > 0 &&
        this.emitter.emit(PoolEvents.busyEnd, this.info)
      this.busyEventEmitted = false
    }
  }

  private checkAndEmitTaskQueuingEvents (): void {
    if (
      this.emitter != null &&
      !this.backPressureEventEmitted &&
      this.backPressure
    ) {
      this.emitter.listenerCount(PoolEvents.backPressure) > 0 &&
        this.emitter.emit(PoolEvents.backPressure, this.info)
      this.backPressureEventEmitted = true
    }
  }

  /**
   * Checks if the worker id sent in the received message from a worker is valid.
   * @param message - The received message.
   * @throws {Error} If the worker id is invalid.
   */
  private checkMessageWorkerId (message: MessageValue<Data | Response>): void {
    if (message.workerId == null) {
      throw new Error(
        `Worker message '${JSON.stringify(message)}' received without worker id`
      )
    }
    if (this.getWorkerNodeKeyByWorkerId(message.workerId) === -1) {
      throw new Error(
        `Worker message '${JSON.stringify(message)}' received from unknown worker ${message.workerId.toString()}`
      )
    }
  }

  private checkMinimumNumberOfWorkers (
    minimumNumberOfWorkers: number | undefined
  ): void {
    if (minimumNumberOfWorkers == null) {
      throw new Error(
        'Cannot instantiate a pool without specifying the number of workers'
      )
    }
    if (!Number.isSafeInteger(minimumNumberOfWorkers)) {
      throw new TypeError(
        'Cannot instantiate a pool with a non safe integer number of workers'
      )
    }
    if (minimumNumberOfWorkers < 0) {
      throw new RangeError(
        'Cannot instantiate a pool with a negative number of workers'
      )
    }
    if (this.type === PoolTypes.fixed && minimumNumberOfWorkers === 0) {
      throw new RangeError('Cannot instantiate a fixed pool with zero worker')
    }
  }

  private checkPoolOptions (opts: PoolOptions<Worker>): void {
    if (isPlainObject(opts)) {
      this.opts.startWorkers = opts.startWorkers ?? true
      checkValidWorkerChoiceStrategy(opts.workerChoiceStrategy)
      this.opts.workerChoiceStrategy =
        opts.workerChoiceStrategy ?? WorkerChoiceStrategies.LEAST_USED
      this.checkValidWorkerChoiceStrategyOptions(
        opts.workerChoiceStrategyOptions
      )
      if (opts.workerChoiceStrategyOptions != null) {
        this.opts.workerChoiceStrategyOptions = opts.workerChoiceStrategyOptions
      }
      this.opts.restartWorkerOnError = opts.restartWorkerOnError ?? true
      this.opts.enableEvents = opts.enableEvents ?? true
      this.opts.enableTasksQueue = opts.enableTasksQueue ?? false
      if (this.opts.enableTasksQueue) {
        checkValidTasksQueueOptions(opts.tasksQueueOptions)
        this.opts.tasksQueueOptions = this.buildTasksQueueOptions(
          opts.tasksQueueOptions
        )
      }
    } else {
      throw new TypeError('Invalid pool options: must be a plain object')
    }
  }

  private checkPoolType (): void {
    if (this.type === PoolTypes.fixed && this.maximumNumberOfWorkers != null) {
      throw new Error(
        'Cannot instantiate a fixed pool with a maximum number of workers defined at initialization'
      )
    }
  }

  private checkValidWorkerChoiceStrategyOptions (
    workerChoiceStrategyOptions: undefined | WorkerChoiceStrategyOptions
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

  /**
   * Chooses a worker node for the next task.
   * @param name - The task function name.
   * @returns The chosen worker node key, or `undefined` while runtime task functions bootstrap.
   */
  private chooseWorkerNode (name?: string): number | undefined {
    if (this.workerTaskFunctionBootstraps.size > 0) return
    const workerNodeKeys = this.getTaskFunctionWorkerNodeKeys(name)
    if (workerNodeKeys != null) {
      const maxPoolSize =
        this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
      const targetSize = max(...workerNodeKeys) + 1
      while (
        this.started &&
        !this.destroying &&
        this.workerNodes.length < targetSize &&
        this.workerNodes.length < maxPoolSize
      ) {
        this.createAndSetupDynamicWorkerNode()
      }
    } else if (this.shallCreateDynamicWorker()) {
      const workerNodeKey = this.createAndSetupDynamicWorkerNode()
      if (
        this.workerChoiceStrategiesContext?.getPolicy().dynamicWorkerUsage ===
          true &&
        !this.workerTaskFunctionBootstraps.has(this.workerNodes[workerNodeKey])
      ) {
        return workerNodeKey
      }
    }
    if (this.workerTaskFunctionBootstraps.size > 0) return
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.workerChoiceStrategiesContext!.execute(
      this.getTaskFunctionWorkerChoiceStrategy(name),
      workerNodeKeys != null ? new Set(workerNodeKeys) : undefined
    )
  }

  /**
   * Creates a worker node.
   * @returns The created worker node.
   */
  private createWorkerNode (): IWorkerNode<Worker, Data> {
    const workerNode = new WorkerNode<Worker, Data>(
      this.worker,
      this.filePath,
      {
        env: Object.hasOwn(this.opts, 'env') ? this.opts.env : undefined,
        tasksQueueAgingFactor: this.opts.tasksQueueOptions?.agingFactor,
        tasksQueueBackPressureSize:
          this.opts.tasksQueueOptions?.size ??
          getDefaultTasksQueueOptions(
            this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
          ).size,
        tasksQueueBucketSize: defaultBucketSize,
        tasksQueueLoadExponent: this.opts.tasksQueueOptions?.loadExponent,
        tasksQueuePriority: this.getTasksQueuePriority(),
        workerOptions: Object.hasOwn(this.opts, 'workerOptions')
          ? this.opts.workerOptions
          : undefined,
      }
    )
    // Flag the worker node as ready at pool startup.
    if (this.starting) {
      workerNode.info.ready = true
    }
    return workerNode
  }

  private dequeueTask (workerNodeKey: number): Task<Data> | undefined {
    const task = this.workerNodes[workerNodeKey].dequeueTask()
    this.checkAndEmitTaskDequeuingEvents()
    return task
  }

  private deregisterTaskFunctionOperationExitListener (
    workerNode: IWorkerNode<Worker, Data>,
    listener: () => void
  ): void {
    const listeners =
      this.workerTaskFunctionOperationExitListeners.get(workerNode)
    if (listeners != null) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.workerTaskFunctionOperationExitListeners.delete(workerNode)
      }
    }
  }

  private endTaskFunctionOperation (): void {
    if (--this.pendingTaskFunctionOperations === 0) {
      const resolve = this.resolveTaskFunctionOperations
      delete this.taskFunctionOperationsFinished
      delete this.resolveTaskFunctionOperations
      resolve?.(undefined)
    }
  }

  private enqueueTask (workerNodeKey: number, task: Task<Data>): number {
    this.updateTaskWorkerNodeKey(workerNodeKey, task)
    const tasksQueueSize = this.workerNodes[workerNodeKey].enqueueTask(task)
    this.checkAndEmitTaskQueuingEvents()
    return tasksQueueSize
  }

  /**
   * Executes the given task on the worker given its worker node key.
   * @param workerNodeKey - The worker node key.
   * @param task - The task to execute.
   * @returns Whether the worker accepted the task.
   */
  private executeTask (workerNodeKey: number, task: Task<Data>): boolean {
    this.updateTaskWorkerNodeKey(workerNodeKey, task)
    const workerNode = this.workerNodes[workerNodeKey]
    const { transferList } = task
    this.beforeTaskExecutionHook(workerNodeKey, task)
    try {
      this.sendToWorker(workerNodeKey, task, transferList)
    } catch (error) {
      if (workerNode.usage.tasks.executing > 0) {
        --workerNode.usage.tasks.executing
      }
      if (this.shallUpdateTaskFunctionWorkerUsage(workerNode.info)) {
        const taskFunctionWorkerUsage =
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          workerNode.getTaskFunctionWorkerUsage(task.name!)
        if (
          taskFunctionWorkerUsage != null &&
          taskFunctionWorkerUsage.tasks.executing > 0
        ) {
          --taskFunctionWorkerUsage.tasks.executing
        }
      }
      if (task.taskId != null) {
        const promiseResponse = this.promiseResponseMap.get(task.taskId)
        if (promiseResponse != null) {
          this.rejectTask(task.taskId, promiseResponse, error)
        }
      }
      return false
    }
    this.checkAndEmitTaskExecutionEvents()
    return true
  }

  private flushTasksQueues (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.flushTasksQueue(workerNodeKey)
    }
  }

  private readonly getAbortError = (
    taskName: string,
    taskId: undefined | UUID,
    abortSignal?: AbortSignal
  ): Error => {
    const abortError = abortSignal?.reason as Error | string
    return abortError instanceof Error
      ? abortError
      : typeof abortError === 'string'
        ? new Error(abortError)
        : new Error(`Task '${taskName}' id '${taskId ?? randomUUID()}' aborted`)
  }

  private getQueuedTasks (): number {
    return this.workerNodes.reduce((accumulator, workerNode) => {
      return accumulator + workerNode.usage.tasks.queued
    }, 0)
  }

  private getStealingWorkerNodes (): number {
    return this.workerNodes.reduce(
      (accumulator, _, workerNodeKey) =>
        this.isWorkerNodeStealing(workerNodeKey)
          ? accumulator + 1
          : accumulator,
      0
    )
  }

  /**
   * Gets task function worker choice strategy, if any.
   * @param name - The task function name.
   * @returns The task function worker choice strategy if the task function worker choice strategy is defined, `undefined` otherwise.
   */
  private readonly getTaskFunctionWorkerChoiceStrategy = (
    name?: string
  ): undefined | WorkerChoiceStrategy => {
    name = name ?? DEFAULT_TASK_NAME
    const taskFunctionsProperties = this.listTaskFunctionsProperties()
    if (name === DEFAULT_TASK_NAME) {
      name = taskFunctionsProperties[1]?.name
    }
    return taskFunctionsProperties.find(
      (taskFunctionProperties: TaskFunctionProperties) =>
        taskFunctionProperties.name === name
    )?.strategy
  }

  /**
   * Gets task function worker node keys affinity array, if any.
   * @param name - The task function name.
   * @param taskFunctionsProperties - The task function properties used to resolve affinity.
   * @returns The task function worker node keys affinity array, or `undefined` if not defined.
   */
  private readonly getTaskFunctionWorkerNodeKeys = (
    name?: string,
    taskFunctionsProperties: readonly TaskFunctionProperties[] = this.listTaskFunctionsProperties()
  ): readonly number[] | undefined => {
    name = name ?? DEFAULT_TASK_NAME
    if (name === DEFAULT_TASK_NAME) {
      name = taskFunctionsProperties[1]?.name
    }
    // Keep the affinity lookup free of iterator allocation.
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < taskFunctionsProperties.length; i++) {
      const taskFunctionProperties = taskFunctionsProperties[i]
      if (taskFunctionProperties.name === name) {
        return taskFunctionProperties.workerNodeKeys
      }
    }
    return undefined
  }

  private getTasksQueuePriority (
    taskFunctionsProperties: readonly TaskFunctionProperties[] = this.listTaskFunctionsProperties()
  ): boolean {
    return taskFunctionsProperties.some(
      taskFunctionProperties => taskFunctionProperties.priority != null
    )
  }

  /**
   * Gets the worker choice strategies registered in this pool.
   * @param taskFunctionsProperties - Task function properties used to collect worker choice strategies.
   * @returns The worker choice strategies.
   */
  private readonly getWorkerChoiceStrategies = (
    taskFunctionsProperties: readonly TaskFunctionProperties[] = this.listTaskFunctionsProperties()
  ): Set<WorkerChoiceStrategy> => {
    return new Set([
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.opts.workerChoiceStrategy!,
      ...taskFunctionsProperties
        .map(
          (taskFunctionProperties: TaskFunctionProperties) =>
            taskFunctionProperties.strategy
        )
        .filter(
          (strategy: undefined | WorkerChoiceStrategy) => strategy != null
        ),
    ])
  }

  /**
   * Gets the worker node key given its worker id.
   * @param workerId - The worker id.
   * @returns The worker node key if the worker id is found in the pool worker nodes, `-1` otherwise.
   */
  private getWorkerNodeKeyByWorkerId (workerId: number | undefined): number {
    return this.workerNodes.findIndex(
      workerNode => workerNode.info.id === workerId
    )
  }

  private getWorkerNodeKeyForBootstrap (
    workerNode: IWorkerNode<Worker, Data>
  ): number {
    if (this.destroying) return -1
    return this.workerNodes.indexOf(workerNode)
  }

  /**
   * Gets worker node task function priority, if any.
   * @param workerNodeKey - The worker node key.
   * @param name - The task function name.
   * @returns The worker node task function priority if the worker node task function priority is defined, `undefined` otherwise.
   */
  private readonly getWorkerNodeTaskFunctionPriority = (
    workerNodeKey: number,
    name?: string
  ): number | undefined => {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    if (workerInfo == null) {
      return
    }
    name = name ?? DEFAULT_TASK_NAME
    if (name === DEFAULT_TASK_NAME) {
      name = workerInfo.taskFunctionsProperties?.[1]?.name
    }
    return workerInfo.taskFunctionsProperties?.find(
      (taskFunctionProperties: TaskFunctionProperties) =>
        taskFunctionProperties.name === name
    )?.priority
  }

  /**
   * Gets worker node task function worker choice strategy, if any.
   * @param workerNodeKey - The worker node key.
   * @param name - The task function name.
   * @returns The worker node task function worker choice strategy if the worker node task function worker choice strategy is defined, `undefined` otherwise.
   */
  private readonly getWorkerNodeTaskFunctionWorkerChoiceStrategy = (
    workerNodeKey: number,
    name?: string
  ): undefined | WorkerChoiceStrategy => {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    if (workerInfo == null) {
      return
    }
    name = name ?? DEFAULT_TASK_NAME
    if (name === DEFAULT_TASK_NAME) {
      name = workerInfo.taskFunctionsProperties?.[1]?.name
    }
    return workerInfo.taskFunctionsProperties?.find(
      (taskFunctionProperties: TaskFunctionProperties) =>
        taskFunctionProperties.name === name
    )?.strategy
  }

  private handleTask (workerNodeKey: number, task: Task<Data>): void {
    if (this.shallExecuteTask(workerNodeKey)) {
      this.executeTask(workerNodeKey, task)
    } else {
      this.enqueueTask(workerNodeKey, task)
    }
  }

  private handleTaskExecutionResponse (message: MessageValue<Response>): void {
    const { data, taskId } = message
    let { workerError } = message
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const promiseResponse = this.promiseResponseMap.get(taskId!)
    if (promiseResponse != null) {
      const { asyncResource, reject, resolve, workerNodeKey } = promiseResponse
      if (
        workerError != null &&
        Object.hasOwn(promiseResponse, 'originalData')
      ) {
        workerError = { ...workerError, data: promiseResponse.originalData }
      }
      const workerNode = this.workerNodes[workerNodeKey]
      let error: Error | undefined
      if (workerError != null) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        error = this.handleWorkerError(taskId!, workerError)
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.promiseResponseMap.delete(taskId!)
      if (workerError != null) {
        this.emitter?.emit(PoolEvents.taskError, workerError)
        asyncResource != null
          ? asyncResource.runInAsyncScope(reject, this.emitter, error)
          : reject(error)
      } else {
        asyncResource != null
          ? asyncResource.runInAsyncScope(resolve, this.emitter, data)
          : resolve(data as Response)
      }
      asyncResource?.emitDestroy()
      // A replayed response can outlive its removed worker node.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (workerNode != null) {
        this.afterTaskExecutionHook(workerNodeKey, message)
      }
      queueMicrotask(() => {
        let currentWorkerNodeKey =
          this.workerNodes[workerNodeKey] === workerNode
            ? workerNodeKey
            : this.workerNodes.indexOf(workerNode)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        workerNode?.emit('taskFinished', taskId)
        this.checkAndEmitTaskExecutionFinishedEvents()
        if (currentWorkerNodeKey === -1 || !workerNode.info.ready) {
          return
        }
        if (
          this.started &&
          this.opts.enableTasksQueue === true &&
          !this.destroying
        ) {
          while (
            !this.isWorkerNodeBusy(currentWorkerNodeKey) &&
            this.tasksQueueSize(currentWorkerNodeKey) > 0
          ) {
            if (
              this.executeTask(
                currentWorkerNodeKey,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.dequeueTask(currentWorkerNodeKey)!
              )
            ) {
              break
            }
            currentWorkerNodeKey = this.workerNodes.indexOf(workerNode)
            // Rejection callbacks can synchronously change pool and worker state.
            /* eslint-disable @typescript-eslint/no-unnecessary-condition */
            if (
              currentWorkerNodeKey === -1 ||
              !this.started ||
              this.destroying ||
              !workerNode.info.ready ||
              !this.opts.enableTasksQueue
            ) {
              return
            }
            /* eslint-enable @typescript-eslint/no-unnecessary-condition */
          }
          if (this.isWorkerNodeIdle(currentWorkerNodeKey)) {
            workerNode.emit('idle', {
              workerNodeKey: currentWorkerNodeKey,
            })
          }
        }
        if (this.shallCreateDynamicWorker()) {
          this.createAndSetupDynamicWorkerNode()
        }
      })
    }
  }

  private readonly handleWorkerError = (
    taskId: UUID,
    workerError: WorkerError
  ): Error => {
    const { aborted, error, message, name, stack } = workerError
    if (aborted) {
      return this.getAbortError(
        name ?? DEFAULT_TASK_NAME,
        taskId,
        this.promiseResponseMap.get(taskId)?.abortSignal
      )
    }
    if (error != null) {
      return error
    }
    const wError = new Error(message)
    wError.stack = stack
    return wError
  }

  private readonly handleWorkerNodeBackPressureEvent = (
    eventDetail: WorkerNodeEventDetail
  ): void => {
    if (
      this.cannotStealTask() ||
      this.backPressure ||
      this.isStealingRatioReached()
    ) {
      return
    }
    const sizeOffset = 1
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (this.opts.tasksQueueOptions!.size! <= sizeOffset) {
      return
    }
    const { workerId } = eventDetail
    const sourceWorkerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    const sourceWorkerNode = this.workerNodes[sourceWorkerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (sourceWorkerNode == null) {
      return
    }
    const workerNodes = this.workerNodes
      .slice()
      .sort(
        (workerNodeA, workerNodeB) =>
          workerNodeA.usage.tasks.queued - workerNodeB.usage.tasks.queued
      )
    for (const workerNode of workerNodes) {
      if (sourceWorkerNode.usage.tasks.queued === 0) {
        break
      }
      if (
        workerNode !== sourceWorkerNode &&
        !workerNode.info.backPressureStealing &&
        workerNode.usage.tasks.queued <
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.opts.tasksQueueOptions!.size! - sizeOffset
      ) {
        const workerNodeKey = this.workerNodes.indexOf(workerNode)
        workerNode.info.backPressureStealing = true
        this.stealTask(sourceWorkerNode, workerNodeKey)
        workerNode.info.backPressureStealing = false
      }
    }
  }

  private readonly handleWorkerNodeIdleEvent = (
    eventDetail: WorkerNodeEventDetail,
    previousStolenTask?: Task<Data>
  ): void => {
    const { workerNodeKey } = eventDetail
    if (workerNodeKey == null) {
      throw new Error(
        "WorkerNode event detail 'workerNodeKey' property must be defined"
      )
    }
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode == null) {
      return
    }
    if (
      !workerNode.info.continuousStealing &&
      (this.cannotStealTask() || this.isStealingRatioReached())
    ) {
      return
    }
    const workerNodeTasksUsage = workerNode.usage.tasks
    if (
      workerNode.info.continuousStealing &&
      !this.isWorkerNodeIdle(workerNodeKey)
    ) {
      workerNode.info.continuousStealing = false
      if (workerNodeTasksUsage.sequentiallyStolen > 0) {
        this.resetTaskSequentiallyStolenStatisticsWorkerUsage(
          workerNodeKey,
          previousStolenTask?.name
        )
      }
      return
    }
    workerNode.info.continuousStealing = true
    const stolenTask = this.workerNodeStealTask(workerNodeKey)
    this.updateTaskSequentiallyStolenStatisticsWorkerUsage(
      workerNodeKey,
      stolenTask?.name,
      previousStolenTask?.name
    )
    sleep(exponentialDelay(workerNodeTasksUsage.sequentiallyStolen))
      .then(() => {
        // Worker nodes can be removed during the delay, shifting the keys.
        const currentWorkerNodeKey = this.workerNodes.indexOf(workerNode)
        if (currentWorkerNodeKey === -1) {
          return undefined
        }
        this.handleWorkerNodeIdleEvent(
          { ...eventDetail, workerNodeKey: currentWorkerNodeKey },
          stolenTask
        )
        return undefined
      })
      .catch((error: unknown) => {
        this.emitter?.emit(PoolEvents.error, error)
      })
  }

  private handleWorkerReadyResponse (message: MessageValue<Response>): void {
    const { ready, taskFunctionsProperties, workerId } = message
    if (ready == null || !ready) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Worker ${workerId?.toString()} failed to initialize`)
    }
    const maxPoolSize =
      this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
    for (const taskFunctionProperties of taskFunctionsProperties ?? []) {
      checkValidWorkerNodeKeys(
        taskFunctionProperties.workerNodeKeys,
        maxPoolSize
      )
    }
    const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    const workerNode = this.workerNodes[workerNodeKey]
    const bootstrap = this.workerTaskFunctionBootstraps.get(workerNode)
    if (bootstrap != null) bootstrap.ready = ready
    workerNode.info.ready = bootstrap == null
    workerNode.info.taskFunctionsProperties = taskFunctionsProperties
    this.sendStatisticsMessageToWorker(workerNodeKey)
    this.setTasksQueuePriority(workerNodeKey)
    this.checkAndEmitReadyEvent()
  }

  private initEventEmitter (): void {
    this.emitter = new EventEmitterAsyncResource({
      name: `poolifier:${this.type}-${this.worker}-pool`,
    })
  }

  /**
   * Initializes the worker node usage with sensible default values gathered during runtime.
   * @param workerNode - The worker node.
   */
  private initWorkerNodeUsage (workerNode: IWorkerNode<Worker, Data>): void {
    const taskStatisticsRequirements =
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
    if (taskStatisticsRequirements?.runTime.aggregate === true) {
      workerNode.usage.runTime.aggregate = min(
        ...this.workerNodes.map(
          workerNode =>
            workerNode.usage.runTime.aggregate ?? Number.POSITIVE_INFINITY
        )
      )
    }
    if (taskStatisticsRequirements?.waitTime.aggregate === true) {
      workerNode.usage.waitTime.aggregate = min(
        ...this.workerNodes.map(
          workerNode =>
            workerNode.usage.waitTime.aggregate ?? Number.POSITIVE_INFINITY
        )
      )
    }
    if (taskStatisticsRequirements?.elu.aggregate === true) {
      workerNode.usage.elu.active.aggregate = min(
        ...this.workerNodes.map(
          workerNode =>
            workerNode.usage.elu.active.aggregate ?? Number.POSITIVE_INFINITY
        )
      )
    }
  }

  private async internalExecute (
    data?: Data,
    name?: string,
    abortSignal?: AbortSignal,
    transferList?: readonly Transferable[]
  ): Promise<Response> {
    this.throwIfTaskAborted(name, abortSignal)
    const timestamp = performance.now()
    let chosenWorkerNodeKey = this.chooseWorkerNode(name)
    while (chosenWorkerNodeKey == null) {
      await this.waitForWorkerTaskFunctionBootstraps(abortSignal, name)
      this.throwIfTaskAborted(name, abortSignal)
      if (!this.started) {
        throw new Error('Cannot execute a task on not started pool')
      }
      if (this.destroying) {
        throw new Error('Cannot execute a task on destroying pool')
      }
      chosenWorkerNodeKey = this.chooseWorkerNode(name)
    }
    const workerNodeKey = chosenWorkerNodeKey
    return await new Promise<Response>((resolve, reject) => {
      const task: Task<Data> = {
        abortable: abortSignal != null,
        data: data ?? ({} as Data),
        name: name ?? DEFAULT_TASK_NAME,
        priority: this.getWorkerNodeTaskFunctionPriority(workerNodeKey, name),
        strategy: this.getWorkerNodeTaskFunctionWorkerChoiceStrategy(
          workerNodeKey,
          name
        ),
        taskId: randomUUID(),
        timestamp,
        transferList,
      }

      const promiseResponse: PromiseResponseWrapper<Response> = {
        reject,
        resolve,
        workerNodeKey,
        ...(this.emitter != null && {
          asyncResource: new AsyncResource('poolifier:task', {
            requireManualDestroy: true,
            triggerAsyncId: this.emitter.asyncId,
          }),
        }),
        abortSignal,
        ...(transferList != null &&
          transferList.length > 0 && { originalData: task.data }),
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.promiseResponseMap.set(task.taskId!, promiseResponse)
      abortSignal?.addEventListener(
        'abort',
        () => {
          const workerNodeKey = this.promiseResponseMap.get(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            task.taskId!
          )?.workerNodeKey
          if (workerNodeKey != null) {
            const workerNode = this.workerNodes[workerNodeKey]
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            workerNode?.emit('abortTask', {
              taskId: task.taskId,
              workerId: workerNode.info.id,
            })
          }
        },
        { once: true }
      )
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

  private readonly isStealingRatioReached = (): boolean => {
    return (
      this.opts.tasksQueueOptions?.tasksStealingRatio === 0 ||
      this.getStealingWorkerNodes() >
        Math.ceil(
          this.workerNodes.length *
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.opts.tasksQueueOptions!.tasksStealingRatio!
        )
    )
  }

  private isWorkerNodeBackPressured (workerNodeKey: number): boolean {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode == null) {
      return false
    }
    return workerNode.info.ready && workerNode.info.backPressure
  }

  private isWorkerNodeBusy (workerNodeKey: number): boolean {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode == null) {
      return false
    }
    if (this.opts.enableTasksQueue === true) {
      return (
        workerNode.info.ready &&
        workerNode.usage.tasks.executing >=
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.opts.tasksQueueOptions!.concurrency!
      )
    }
    return workerNode.info.ready && workerNode.usage.tasks.executing > 0
  }

  private isWorkerNodeIdle (workerNodeKey: number): boolean {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode == null) {
      return false
    }
    if (this.opts.enableTasksQueue === true) {
      return (
        workerNode.info.ready &&
        workerNode.usage.tasks.executing === 0 &&
        this.tasksQueueSize(workerNodeKey) === 0
      )
    }
    return workerNode.info.ready && workerNode.usage.tasks.executing === 0
  }

  private isWorkerNodeStealing (workerNodeKey: number): boolean {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode == null) {
      return false
    }
    return (
      workerNode.info.ready &&
      (workerNode.info.continuousStealing ||
        workerNode.info.backPressureStealing)
    )
  }

  private redistributeQueuedTasks (
    sourceWorkerNode: IWorkerNode<Worker, Data>
  ): void {
    while (sourceWorkerNode.tasksQueue.size > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const task = sourceWorkerNode.dequeueTask()!
      const { taskId } = task
      if (taskId == null) {
        continue
      }
      const promiseResponse = this.promiseResponseMap.get(taskId)
      if (promiseResponse == null) {
        continue
      }
      if (promiseResponse.abortSignal?.aborted === true) {
        this.rejectTask(
          taskId,
          promiseResponse,
          this.getAbortError(
            task.name ?? DEFAULT_TASK_NAME,
            taskId,
            promiseResponse.abortSignal
          )
        )
        continue
      }
      if (!this.started || this.destroying) {
        continue
      }
      const liveTaskFunctionsProperties = this.listTaskFunctionsProperties()
      const workerNodeKeys = this.getTaskFunctionWorkerNodeKeys(
        task.name,
        liveTaskFunctionsProperties.length > 0
          ? liveTaskFunctionsProperties
          : (sourceWorkerNode.info.taskFunctionsProperties ??
              liveTaskFunctionsProperties)
      )
      const candidateCount = workerNodeKeys?.length ?? this.workerNodes.length
      let destinationWorkerNodeKey = -1
      let minimumQueuedTasks = Number.POSITIVE_INFINITY
      for (let i = 0; i < candidateCount; i++) {
        const candidateWorkerNodeKey =
          workerNodeKeys == null ? i : workerNodeKeys[i]
        if (candidateWorkerNodeKey >= this.workerNodes.length) {
          continue
        }
        const candidateWorkerNode = this.workerNodes[candidateWorkerNodeKey]
        if (!candidateWorkerNode.info.ready) {
          continue
        }
        const queuedTasks = candidateWorkerNode.usage.tasks.queued
        if (
          queuedTasks < minimumQueuedTasks ||
          (queuedTasks === minimumQueuedTasks &&
            candidateWorkerNodeKey < destinationWorkerNodeKey)
        ) {
          destinationWorkerNodeKey = candidateWorkerNodeKey
          minimumQueuedTasks = queuedTasks
        }
      }
      if (destinationWorkerNodeKey === -1) {
        continue
      }
      if (this.opts.enableTasksQueue === true) {
        this.handleTask(destinationWorkerNodeKey, task)
      } else {
        this.executeTask(destinationWorkerNodeKey, task)
      }
    }
  }

  private registerTaskFunctionOperationExitListener (
    workerNode: IWorkerNode<Worker, Data>,
    listener: () => void
  ): void {
    let listeners =
      this.workerTaskFunctionOperationExitListeners.get(workerNode)
    if (listeners == null) {
      listeners = new Set()
      this.workerTaskFunctionOperationExitListeners.set(workerNode, listeners)
    }
    listeners.add(listener)
  }

  private registerWorkerLifecycleMessageListener (
    workerNodeKey: number,
    listener: (message: MessageValue<Response>) => void
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    const messageTarget = workerNode.messageChannel?.port1 ?? workerNode.worker
    // Retire lifecycle consumers without discarding buffered kill acknowledgements.
    workerNode.worker.prependOnceListener('exit', () => {
      messageTarget.off('message', listener)
    })
    this.registerWorkerMessageListener(workerNodeKey, listener)
  }

  private rejectTask (
    taskId: UUID,
    promiseResponse: PromiseResponseWrapper<Response>,
    error: unknown
  ): void {
    if (this.promiseResponseMap.get(taskId) !== promiseResponse) {
      return
    }
    this.promiseResponseMap.delete(taskId)
    const { asyncResource, reject } = promiseResponse
    try {
      asyncResource != null
        ? asyncResource.runInAsyncScope(reject, this.emitter, error)
        : reject(error)
    } finally {
      asyncResource?.emitDestroy()
    }
  }

  /**
   * Rejects tasks still owned by a worker that cannot complete them.
   * @param workerNodeTasks - The task wrappers owned by the failed worker node.
   * @param error - The worker failure.
   */
  private rejectWorkerNodeTasks (
    workerNodeTasks: Map<UUID, PromiseResponseWrapper<Response>>,
    error?: Error
  ): void {
    for (const [taskId, promiseResponse] of workerNodeTasks) {
      if (
        this.promiseResponseMap.get(taskId) === promiseResponse &&
        promiseResponse.workerNodeKey === -1
      ) {
        error ??= new Error('Worker exited before completing the task')
        this.rejectTask(taskId, promiseResponse, error)
      }
    }
  }

  /**
   * Removes the worker node from the pool worker nodes.
   * @param workerNode - The worker node.
   */
  private removeWorkerNode (workerNode: IWorkerNode<Worker, Data>): void {
    this.workerTaskFunctionBootstraps.delete(workerNode)
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey !== -1) {
      this.workerNodes.splice(workerNodeKey, 1)
      for (const promiseResponse of this.promiseResponseMap.values()) {
        if (promiseResponse.workerNodeKey === workerNodeKey) {
          promiseResponse.workerNodeKey = -1
        } else if (promiseResponse.workerNodeKey > workerNodeKey) {
          --promiseResponse.workerNodeKey
        }
      }
      this.workerChoiceStrategiesContext?.remove(workerNodeKey)
      workerNode.info.dynamic &&
        this.checkAndEmitDynamicWorkerDestructionEvents()
    }
  }

  private async replayTaskFunctions (workerNodeKey: number): Promise<void> {
    if (this.taskFunctions.size === 0) return
    const workerNode = this.workerNodes[workerNodeKey]
    for (const [taskFunctionName, taskFunctionObject] of this.taskFunctions) {
      const currentWorkerNodeKey = this.getWorkerNodeKeyForBootstrap(workerNode)
      if (currentWorkerNodeKey === -1) return
      await this.sendTaskFunctionOperationToWorker(currentWorkerNodeKey, {
        taskFunction: taskFunctionObject.taskFunction.toString(),
        taskFunctionOperation: 'add',
        taskFunctionProperties: buildTaskFunctionProperties(
          taskFunctionName,
          taskFunctionObject
        ),
      })
    }
  }

  private async replayTaskFunctionsAfterOperations (
    workerNode: IWorkerNode<Worker, Data>,
    bootstrap: { ready: boolean }
  ): Promise<void> {
    try {
      // Publish the bootstrap promise before sending replay requests.
      do {
        await this.taskFunctionOperationsFinished
      } while (this.taskFunctionOperationsFinished != null)
      let workerNodeKey = this.getWorkerNodeKeyForBootstrap(workerNode)
      if (workerNodeKey === -1) return
      await this.replayTaskFunctions(workerNodeKey)
      workerNodeKey = this.getWorkerNodeKeyForBootstrap(workerNode)
      if (workerNodeKey === -1) return
      if (this.defaultTaskFunctionName != null) {
        await this.sendTaskFunctionOperationToWorker(workerNodeKey, {
          taskFunctionOperation: 'default',
          taskFunctionProperties: buildTaskFunctionProperties(
            this.defaultTaskFunctionName,
            this.taskFunctions.get(this.defaultTaskFunctionName)
          ),
        })
        workerNodeKey = this.getWorkerNodeKeyForBootstrap(workerNode)
        if (workerNodeKey === -1) return
      }
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        this.getWorkerChoiceStrategies(workerNode.info.taskFunctionsProperties)
      )
      this.sendStatisticsMessageToWorker(workerNodeKey)
      workerNode.info.ready = bootstrap.ready
      this.checkAndEmitReadyEvent()
    } finally {
      this.workerTaskFunctionBootstraps.delete(workerNode)
    }
  }

  private resetTaskSequentiallyStolenStatisticsWorkerUsage (
    workerNodeKey: number,
    taskName?: string
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode?.usage != null) {
      workerNode.usage.tasks.sequentiallyStolen = 0
    }
    if (
      taskName != null &&
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey)
      ) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      workerNode.getTaskFunctionWorkerUsage(
        taskName
      )!.tasks.sequentiallyStolen = 0
    }
  }

  private async sendKillMessageToWorker (
    workerNodeKey: number,
    timeout = 1000
  ): Promise<void> {
    const workerId = this.getWorkerInfo(workerNodeKey)?.id
    let timeoutHandle: NodeJS.Timeout | undefined
    let killMessageListener:
      | ((message: MessageValue<Response>) => void)
      | undefined
    try {
      await new Promise<void>((resolve, reject) => {
        timeoutHandle =
          timeout >= 0
            ? setTimeout(() => {
              resolve()
            }, timeout)
            : undefined
        killMessageListener = (message: MessageValue<Response>): void => {
          if (message.workerId !== workerId) {
            return
          }
          if (message.kill === 'success') {
            resolve()
          } else if (message.kill === 'failure') {
            reject(
              new Error(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Kill message handling failed on worker ${message.workerId?.toString()}`
              )
            )
          }
        }
        this.registerWorkerMessageListener(workerNodeKey, killMessageListener)
        this.sendToWorker(workerNodeKey, { kill: true })
      })
    } finally {
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle)
      }
      const currentWorkerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
      if (killMessageListener != null && currentWorkerNodeKey !== -1) {
        this.deregisterWorkerMessageListener(
          currentWorkerNodeKey,
          killMessageListener
        )
      }
    }
  }

  /**
   * Sends the statistics message to worker given its worker node key.
   * @param workerNodeKey - The worker node key.
   */
  private sendStatisticsMessageToWorker (workerNodeKey: number): void {
    const taskStatisticsRequirements =
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
    this.sendToWorker(workerNodeKey, {
      statistics: {
        elu: taskStatisticsRequirements?.elu.aggregate ?? false,
        runTime: taskStatisticsRequirements?.runTime.aggregate ?? false,
      },
    })
  }

  private async sendTaskFunctionOperationToWorker (
    workerNodeKey: number,
    message: MessageValue<Data>
  ): Promise<boolean> {
    const workerNode = this.workerNodes[workerNodeKey]
    const workerId = this.getWorkerInfo(workerNodeKey)?.id
    const messageTarget = workerNode.messageChannel?.port1 ?? workerNode.worker
    const taskFunctionOperationId = randomUUID()
    const { promise, reject, resolve } = Promise.withResolvers<boolean>()
    const listener = (message: MessageValue<Response>): void => {
      if (
        message.taskFunctionOperationStatus != null &&
        message.workerId === workerId &&
        message.taskFunctionOperationId === taskFunctionOperationId
      ) {
        this.checkMessageWorkerId(message)
        if (message.taskFunctionOperationStatus) {
          resolve(true)
          return
        }
        reject(
          new Error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Task function operation '${message.taskFunctionOperation?.toString()}' failed on worker ${message.workerId?.toString()} with error: '${
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              message.workerError?.message
            }'`
          )
        )
      }
    }
    const exitListener = (): void => {
      reject(
        new Error(
          `Worker ${String(workerId)} exited before acknowledging task function operation '${message.taskFunctionOperation ?? 'unknown'}'`
        )
      )
    }
    try {
      this.registerTaskFunctionOperationExitListener(workerNode, exitListener)
      this.registerWorkerMessageListener(workerNodeKey, listener)
      this.sendToWorker(workerNodeKey, {
        ...message,
        taskFunctionOperationId,
      })
    } catch (error) {
      reject(error)
    }
    try {
      return await promise
    } finally {
      this.deregisterTaskFunctionOperationExitListener(workerNode, exitListener)
      messageTarget.off('message', listener)
    }
  }

  private async sendTaskFunctionOperationToWorkers (
    message: MessageValue<Data>
  ): Promise<boolean> {
    if (this.workerNodes.length === 0) {
      return true
    }
    const taskFunctionOperationId = randomUUID()
    const responsesReceived = new Map<
      number | undefined,
      MessageValue<Response> | undefined
    >()
    for (const workerNode of this.workerNodes) {
      responsesReceived.set(workerNode.info.id, undefined)
    }
    let remainingResponses = responsesReceived.size
    let errorResponse: MessageValue<Response> | undefined
    const { promise, reject, resolve } = Promise.withResolvers<boolean>()
    const listeners: {
      exitListener: () => void
      messageTarget: MessagePort | Worker
      workerNode: IWorkerNode<Worker, Data>
    }[] = []
    const complete = (): void => {
      if (remainingResponses !== 0) return
      if (errorResponse != null) {
        reject(
          new Error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Task function operation '${message.taskFunctionOperation as string}' failed on worker ${errorResponse.workerId?.toString()} with error: '${errorResponse.workerError?.message ?? 'Unknown error'}'`
          )
        )
      } else if (responsesReceived.size === 0) {
        reject(
          new Error(
            `All targets exited before acknowledging task function operation '${message.taskFunctionOperation ?? 'unknown'}'`
          )
        )
      } else {
        resolve(true)
      }
    }
    const listener = (message: MessageValue<Response>): void => {
      if (
        message.taskFunctionOperationStatus != null &&
        message.taskFunctionOperationId === taskFunctionOperationId &&
        responsesReceived.has(message.workerId) &&
        responsesReceived.get(message.workerId) == null
      ) {
        this.checkMessageWorkerId(message)
        responsesReceived.set(message.workerId, message)
        --remainingResponses
        if (!message.taskFunctionOperationStatus) {
          errorResponse ??= message
        }
        complete()
      }
    }
    try {
      for (const workerId of responsesReceived.keys()) {
        const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
        const workerNode = this.workerNodes[workerNodeKey]
        const messageTarget =
          workerNode.messageChannel?.port1 ?? workerNode.worker
        const exitListener = (): void => {
          if (
            responsesReceived.has(workerId) &&
            responsesReceived.get(workerId) == null
          ) {
            responsesReceived.delete(workerId)
            --remainingResponses
            complete()
          }
        }
        listeners.push({ exitListener, messageTarget, workerNode })
        this.registerTaskFunctionOperationExitListener(workerNode, exitListener)
        this.registerWorkerMessageListener(workerNodeKey, listener)
        this.sendToWorker(workerNodeKey, {
          ...message,
          taskFunctionOperationId,
        })
      }
    } catch (error) {
      reject(error)
    }
    try {
      return await promise
    } finally {
      for (const { exitListener, messageTarget, workerNode } of listeners) {
        this.deregisterTaskFunctionOperationExitListener(
          workerNode,
          exitListener
        )
        messageTarget.off('message', listener)
      }
    }
  }

  private setTasksQueuePriority (workerNodeKey: number): void {
    this.workerNodes[workerNodeKey].setTasksQueuePriority(
      this.getTasksQueuePriority(
        this.workerNodes[workerNodeKey].info.taskFunctionsProperties
      )
    )
  }

  private setTasksQueueSize (size: number): void {
    for (const workerNode of this.workerNodes) {
      workerNode.tasksQueueBackPressureSize = size
    }
  }

  private setTasksStealingOnBackPressure (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].on(
        'backPressure',
        this.handleWorkerNodeBackPressureEvent
      )
    }
  }

  private setTaskStealing (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].on('idle', this.handleWorkerNodeIdleEvent)
    }
  }

  private shallExecuteTask (workerNodeKey: number): boolean {
    return (
      this.tasksQueueSize(workerNodeKey) === 0 &&
      this.workerNodes[workerNodeKey].usage.tasks.executing <
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.opts.tasksQueueOptions!.concurrency!
    )
  }

  /**
   * Whether the worker node shall update its task function worker usage or not.
   * @param workerInfo - The worker information.
   * @returns `true` if the worker node shall update its task function worker usage, `false` otherwise.
   */
  private shallUpdateTaskFunctionWorkerUsage (
    workerInfo: undefined | WorkerInfo
  ): boolean {
    return (
      workerInfo != null &&
      Array.isArray(workerInfo.taskFunctionsProperties) &&
      workerInfo.taskFunctionsProperties.length > 2
    )
  }

  /**
   * Starts the minimum number of workers.
   * @param initWorkerNodeUsage - Whether to initialize the worker node usage or not.
   * @defaultValue false
   */
  private startMinimumNumberOfWorkers (initWorkerNodeUsage = false): void {
    if (this.minimumNumberOfWorkers === 0) {
      return
    }
    this.startingMinimumNumberOfWorkers = true
    try {
      while (
        this.workerNodes.reduce(
          (accumulator, workerNode) =>
            !workerNode.info.dynamic ? accumulator + 1 : accumulator,
          0
        ) < this.minimumNumberOfWorkers
      ) {
        const workerNodeKey = this.createAndSetupWorkerNode()
        initWorkerNodeUsage &&
          this.initWorkerNodeUsage(this.workerNodes[workerNodeKey])
      }
    } finally {
      this.startingMinimumNumberOfWorkers = false
    }
  }

  private readonly stealTask = (
    sourceWorkerNode: IWorkerNode<Worker, Data>,
    destinationWorkerNodeKey: number
  ): Task<Data> | undefined => {
    const destinationWorkerNode = this.workerNodes[destinationWorkerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (destinationWorkerNode == null) {
      return
    }
    // Avoid cross and cascade task stealing. Could be smarter by checking stealing/stolen worker ids pair.
    if (
      !sourceWorkerNode.info.ready ||
      sourceWorkerNode.info.stolen ||
      sourceWorkerNode.info.stealing ||
      sourceWorkerNode.info.queuedTaskAbortion ||
      !destinationWorkerNode.info.ready ||
      destinationWorkerNode.info.stolen ||
      destinationWorkerNode.info.stealing ||
      destinationWorkerNode.info.queuedTaskAbortion
    ) {
      return
    }
    destinationWorkerNode.info.stealing = true
    sourceWorkerNode.info.stolen = true
    const stolenTask = sourceWorkerNode.dequeueLastPrioritizedTask()
    if (stolenTask == null) {
      sourceWorkerNode.info.stolen = false
      destinationWorkerNode.info.stealing = false
      return
    }
    sourceWorkerNode.info.stolen = false
    destinationWorkerNode.info.stealing = false
    this.handleTask(destinationWorkerNodeKey, stolenTask)
    this.updateTaskStolenStatisticsWorkerUsage(
      destinationWorkerNodeKey,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      stolenTask.name!
    )
    return stolenTask
  }

  private tasksQueueSize (workerNodeKey: number): number {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode == null) {
      return 0
    }
    return workerNode.tasksQueueSize()
  }

  private throwIfTaskAborted (name?: string, abortSignal?: AbortSignal): void {
    if (abortSignal?.aborted === true) {
      throw this.getAbortError(
        name ?? DEFAULT_TASK_NAME,
        undefined,
        abortSignal
      )
    }
  }

  private unsetTasksStealingOnBackPressure (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].off(
        'backPressure',
        this.handleWorkerNodeBackPressureEvent
      )
    }
  }

  private unsetTaskStealing (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].off(
        'idle',
        this.handleWorkerNodeIdleEvent
      )
    }
  }

  private updateTaskSequentiallyStolenStatisticsWorkerUsage (
    workerNodeKey: number,
    taskName?: string,
    previousTaskName?: string
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode?.usage != null && taskName != null) {
      ++workerNode.usage.tasks.sequentiallyStolen
    }
    if (
      taskName != null &&
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey)
      ) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      const taskFunctionWorkerUsage =
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        workerNode.getTaskFunctionWorkerUsage(taskName)!
      if (
        taskFunctionWorkerUsage.tasks.sequentiallyStolen === 0 ||
        (previousTaskName != null &&
          previousTaskName === taskName &&
          taskFunctionWorkerUsage.tasks.sequentiallyStolen > 0)
      ) {
        ++taskFunctionWorkerUsage.tasks.sequentiallyStolen
      } else if (taskFunctionWorkerUsage.tasks.sequentiallyStolen > 0) {
        taskFunctionWorkerUsage.tasks.sequentiallyStolen = 0
      }
    }
  }

  private updateTaskStolenStatisticsWorkerUsage (
    workerNodeKey: number,
    taskName: string
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode?.usage != null) {
      ++workerNode.usage.tasks.stolen
    }
    if (
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey)
      ) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ++workerNode.getTaskFunctionWorkerUsage(taskName)!.tasks.stolen
    }
  }

  /**
   * Updates task ownership before dispatch or synchronous queue events.
   * @param workerNodeKey - The destination worker node key.
   * @param task - The task being moved.
   */
  private updateTaskWorkerNodeKey (
    workerNodeKey: number,
    task: Task<Data>
  ): void {
    if (task.taskId != null) {
      const promiseResponse = this.promiseResponseMap.get(task.taskId)
      if (promiseResponse != null) {
        promiseResponse.workerNodeKey = workerNodeKey
      }
    }
  }

  private async waitForWorkerTaskFunctionBootstraps (
    abortSignal?: AbortSignal,
    name?: string
  ): Promise<void> {
    let abortPromise: Promise<undefined> | undefined
    let abortListener: (() => void) | undefined
    if (abortSignal != null) {
      this.throwIfTaskAborted(name, abortSignal)
      const { promise, reject } = Promise.withResolvers<undefined>()
      abortPromise = promise
      abortListener = () => {
        reject(
          this.getAbortError(name ?? DEFAULT_TASK_NAME, undefined, abortSignal)
        )
      }
      abortSignal.addEventListener('abort', abortListener, { once: true })
    }
    try {
      while (this.workerTaskFunctionBootstraps.size > 0) {
        for (const bootstrap of this.workerTaskFunctionBootstraps.values()) {
          if (bootstrap.promise != null) {
            if (abortPromise != null) {
              await Promise.race([bootstrap.promise, abortPromise])
            } else {
              await bootstrap.promise
            }
          }
        }
      }
    } finally {
      if (abortListener != null) {
        abortSignal?.removeEventListener('abort', abortListener)
      }
    }
  }

  private readonly workerNodeStealTask = (
    workerNodeKey: number
  ): Task<Data> | undefined => {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode == null) return
    const workerNodes = this.workerNodes
      .slice()
      .sort(
        (workerNodeA, workerNodeB) =>
          workerNodeB.usage.tasks.queued - workerNodeA.usage.tasks.queued
      )
    const sourceWorkerNode = workerNodes.find(
      sourceWorkerNode =>
        sourceWorkerNode !== workerNode &&
        sourceWorkerNode.usage.tasks.queued > 0
    )
    if (sourceWorkerNode != null) {
      return this.stealTask(sourceWorkerNode, workerNodeKey)
    }
  }
}
