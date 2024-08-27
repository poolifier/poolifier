import type { TransferListItem } from 'node:worker_threads'

import { AsyncResource } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { EventEmitterAsyncResource } from 'node:events'
import { performance } from 'node:perf_hooks'

import type {
  MessageValue,
  PromiseResponseWrapper,
  Task,
  TaskFunctionProperties,
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
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export abstract class AbstractPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IPool<Worker, Data, Response> {
  /**
   * The task execution response promise map:
   * - `key`: The message id of each submitted task.
   * - `value`: An object that contains task's worker node key, execution response promise resolve and reject callbacks, async resource.
   *
   * When we receive a message from the worker, we get a map entry with the promise resolve/reject bound to the message id.
   */
  protected promiseResponseMap: Map<
    `${string}-${string}-${string}-${string}-${string}`,
    PromiseResponseWrapper<Response>
  > = new Map<
    `${string}-${string}-${string}-${string}-${string}`,
    PromiseResponseWrapper<Response>
  >()

  /**
   * Worker choice strategies context referencing worker choice algorithms implementation.
   */
  protected workerChoiceStrategiesContext?: WorkerChoiceStrategiesContext<
    Worker,
    Data,
    Response
  >

  /**
   * This method is the message listener registered on each worker.
   * @param message - The message received from the worker.
   */
  protected readonly workerMessageListener = (
    message: MessageValue<Response>
  ): void => {
    this.checkMessageWorkerId(message)
    const { ready, taskFunctionsProperties, taskId, workerId } = message
    if (ready != null && taskFunctionsProperties != null) {
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

  /**
   * Whether the pool back pressure event has been emitted or not.
   */
  private backPressureEventEmitted: boolean

  /**
   * Whether the pool is destroying or not.
   */
  private destroying: boolean

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
   * Gets the worker choice strategies registered in this pool.
   * @returns The worker choice strategies.
   */
  private readonly getWorkerChoiceStrategies =
    (): Set<WorkerChoiceStrategy> => {
      return new Set([
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.opts.workerChoiceStrategy!,
        ...this.listTaskFunctionsProperties()
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

  private readonly handleWorkerNodeBackPressureEvent = (
    eventDetail: WorkerNodeEventDetail
  ): void => {
    if (
      this.cannotStealTask() ||
      this.backPressure ||
      (this.info.stealingWorkerNodes ?? 0) >
        Math.round(
          this.workerNodes.length *
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.opts.tasksQueueOptions!.tasksStealingRatio!
        )
    ) {
      return
    }
    const sizeOffset = 1
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (this.opts.tasksQueueOptions!.size! <= sizeOffset) {
      return
    }
    const { workerId } = eventDetail
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
        workerNode.info.id !== workerId &&
        workerNode.usage.tasks.queued <
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.opts.tasksQueueOptions!.size! - sizeOffset
      ) {
        if (workerNode.info.backPressureStealing) {
          continue
        }
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
      (this.cannotStealTask() ||
        (this.info.stealingWorkerNodes ?? 0) >
          Math.round(
            this.workerNodes.length *
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              this.opts.tasksQueueOptions!.tasksStealingRatio!
          ))
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
        this.handleWorkerNodeIdleEvent(eventDetail, stolenTask)
        return undefined
      })
      .catch((error: unknown) => {
        this.emitter?.emit(PoolEvents.error, error)
      })
  }

  /**
   * Whether the pool ready event has been emitted or not.
   */
  private readyEventEmitted: boolean

  /**
   * Whether the pool is started or not.
   */
  private started: boolean

  /**
   * Whether the pool is starting or not.
   */
  private starting: boolean

  /**
   * Whether the minimum number of workers is starting or not.
   */
  private startingMinimumNumberOfWorkers: boolean

  /**
   * The start timestamp of the pool.
   */
  private startTimestamp?: number

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
      !destinationWorkerNode.info.ready ||
      destinationWorkerNode.info.stolen ||
      destinationWorkerNode.info.stealing
    ) {
      return
    }
    destinationWorkerNode.info.stealing = true
    sourceWorkerNode.info.stolen = true
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stolenTask = sourceWorkerNode.dequeueLastPrioritizedTask()!
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

  /**
   * The task functions added at runtime map:
   * - `key`: The task function name.
   * - `value`: The task function object.
   */
  private readonly taskFunctions: Map<
    string,
    TaskFunctionObject<Data, Response>
  >

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
        sourceWorkerNodeKey !== workerNodeKey &&
        sourceWorkerNode.usage.tasks.queued > 0
    )
    if (sourceWorkerNode != null) {
      return this.stealTask(sourceWorkerNode, workerNodeKey)
    }
  }

  /** @inheritDoc */
  public emitter?: EventEmitterAsyncResource

  /** @inheritDoc */
  public readonly workerNodes: IWorkerNode<Worker, Data>[] = []

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
    this.backPressureEventEmitted = false
    this.startingMinimumNumberOfWorkers = false
    if (this.opts.startWorkers === true) {
      this.start()
    }
  }

  /**
   * Hook executed after the worker task execution.
   * Can be overridden.
   * @param workerNodeKey - The worker node key.
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
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
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
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
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
   * Creates a new, completely set up dynamic worker node.
   * @returns New, completely set up dynamic worker node key.
   */
  protected createAndSetupDynamicWorkerNode (): number {
    const workerNodeKey = this.createAndSetupWorkerNode()
    this.registerWorkerMessageListener(workerNodeKey, message => {
      this.checkMessageWorkerId(message)
      const localWorkerNodeKey = this.getWorkerNodeKeyByWorkerId(
        message.workerId
      )
      const workerInfo = this.getWorkerInfo(localWorkerNodeKey)
      // Kill message received from worker
      if (
        isKillBehavior(KillBehaviors.HARD, message.kill) ||
        (isKillBehavior(KillBehaviors.SOFT, message.kill) &&
          this.isWorkerNodeIdle(localWorkerNodeKey) &&
          workerInfo != null &&
          !workerInfo.continuousStealing &&
          !workerInfo.backPressureStealing)
      ) {
        // Flag the worker node as not ready immediately
        this.flagWorkerNodeAsNotReady(localWorkerNodeKey)
        this.destroyWorkerNode(localWorkerNodeKey).catch((error: unknown) => {
          this.emitter?.emit(PoolEvents.error, error)
        })
      }
    })
    this.sendToWorker(workerNodeKey, {
      checkActive: true,
    })
    if (this.taskFunctions.size > 0) {
      for (const [taskFunctionName, taskFunctionObject] of this.taskFunctions) {
        this.sendTaskFunctionOperationToWorker(workerNodeKey, {
          taskFunction: taskFunctionObject.taskFunction.toString(),
          taskFunctionOperation: 'add',
          taskFunctionProperties: buildTaskFunctionProperties(
            taskFunctionName,
            taskFunctionObject
          ),
        }).catch((error: unknown) => {
          this.emitter?.emit(PoolEvents.error, error)
        })
      }
    }
    const workerNode = this.workerNodes[workerNodeKey]
    workerNode.info.dynamic = true
    if (
      this.workerChoiceStrategiesContext?.getPolicy().dynamicWorkerReady ===
        true ||
      this.workerChoiceStrategiesContext?.getPolicy().dynamicWorkerUsage ===
        true
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
    workerNode.registerOnceWorkerEventHandler('error', (error: Error) => {
      workerNode.info.ready = false
      this.emitter?.emit(PoolEvents.error, error)
      if (
        this.started &&
        !this.destroying &&
        this.opts.restartWorkerOnError === true
      ) {
        if (workerNode.info.dynamic) {
          this.createAndSetupDynamicWorkerNode()
        } else if (!this.startingMinimumNumberOfWorkers) {
          this.startMinimumNumberOfWorkers(true)
        }
      }
      if (
        this.started &&
        !this.destroying &&
        this.opts.enableTasksQueue === true
      ) {
        this.redistributeQueuedTasks(this.workerNodes.indexOf(workerNode))
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, promise/no-promise-in-callback
      workerNode?.terminate().catch((error: unknown) => {
        this.emitter?.emit(PoolEvents.error, error)
      })
    })
    workerNode.registerWorkerEventHandler(
      'exit',
      this.opts.exitHandler ?? EMPTY_FUNCTION
    )
    workerNode.registerOnceWorkerEventHandler('exit', () => {
      this.removeWorkerNode(workerNode)
      if (
        this.started &&
        !this.startingMinimumNumberOfWorkers &&
        !this.destroying
      ) {
        this.startMinimumNumberOfWorkers(true)
      }
    })
    const workerNodeKey = this.addWorkerNode(workerNode)
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
      this.executeTask(workerNodeKey, this.dequeueTask(workerNodeKey)!)
      ++flushedTasks
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
    return (
      this.opts.enableTasksQueue === true &&
      this.workerNodes.reduce(
        (accumulator, workerNode) =>
          workerNode.info.backPressure ? accumulator + 1 : accumulator,
        0
      ) === this.workerNodes.length
    )
  }

  /**
   * Whether worker nodes are executing concurrently their tasks quota or not.
   * @returns Worker nodes busyness boolean status.
   */
  protected internalBusy (): boolean {
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
    transferList?: readonly TransferListItem[]
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
   * Adds the given worker node in the pool worker nodes.
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
    return this.workerNodes.length <= 1 || this.info.queuedTasks === 0
  }

  private checkAndEmitEmptyEvent (): void {
    if (this.empty) {
      this.emitter?.emit(PoolEvents.empty, this.info)
    }
  }

  private checkAndEmitReadyEvent (): void {
    if (!this.readyEventEmitted && this.ready) {
      this.emitter?.emit(PoolEvents.ready, this.info)
      this.readyEventEmitted = true
    }
  }

  private checkAndEmitTaskDequeuingEvents (): void {
    if (this.backPressureEventEmitted && !this.backPressure) {
      this.emitter?.emit(PoolEvents.backPressureEnd, this.info)
      this.backPressureEventEmitted = false
    }
  }

  private checkAndEmitTaskExecutionEvents (): void {
    if (this.busy) {
      this.emitter?.emit(PoolEvents.busy, this.info)
    }
  }

  private checkAndEmitTaskQueuingEvents (): void {
    if (!this.backPressureEventEmitted && this.backPressure) {
      this.emitter?.emit(PoolEvents.backPressure, this.info)
      this.backPressureEventEmitted = true
    }
  }

  /**
   * Checks if the worker id sent in the received message from a worker is valid.
   * @param message - The received message.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If the worker id is invalid.
   */
  private checkMessageWorkerId (message: MessageValue<Data | Response>): void {
    if (message.workerId == null) {
      throw new Error('Worker message received without worker id')
    } else if (this.getWorkerNodeKeyByWorkerId(message.workerId) === -1) {
      throw new Error(
        `Worker message received from unknown worker '${message.workerId.toString()}'`
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
      checkValidWorkerChoiceStrategy(opts.workerChoiceStrategy)
      this.opts.workerChoiceStrategy =
        opts.workerChoiceStrategy ?? WorkerChoiceStrategies.ROUND_ROBIN
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
        'Cannot instantiate a fixed pool with a maximum number of workers specified at initialization'
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
   * @returns The chosen worker node key.
   */
  private chooseWorkerNode (name?: string): number {
    if (this.shallCreateDynamicWorker()) {
      const workerNodeKey = this.createAndSetupDynamicWorkerNode()
      if (
        this.workerChoiceStrategiesContext?.getPolicy().dynamicWorkerUsage ===
        true
      ) {
        return workerNodeKey
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.workerChoiceStrategiesContext!.execute(
      this.getTaskFunctionWorkerChoiceStrategy(name)
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
        env: this.opts.env,
        tasksQueueBackPressureSize:
          this.opts.tasksQueueOptions?.size ??
          getDefaultTasksQueueOptions(
            this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
          ).size,
        tasksQueueBucketSize: defaultBucketSize,
        tasksQueuePriority: this.getTasksQueuePriority(),
        workerOptions: this.opts.workerOptions,
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

  private enqueueTask (workerNodeKey: number, task: Task<Data>): number {
    const tasksQueueSize = this.workerNodes[workerNodeKey].enqueueTask(task)
    this.checkAndEmitTaskQueuingEvents()
    return tasksQueueSize
  }

  /**
   * Executes the given task on the worker given its worker node key.
   * @param workerNodeKey - The worker node key.
   * @param task - The task to execute.
   */
  private executeTask (workerNodeKey: number, task: Task<Data>): void {
    this.beforeTaskExecutionHook(workerNodeKey, task)
    this.sendToWorker(workerNodeKey, task, task.transferList)
    this.checkAndEmitTaskExecutionEvents()
  }

  private flushTasksQueues (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.flushTasksQueue(workerNodeKey)
    }
  }

  private getTasksQueuePriority (): boolean {
    return this.listTaskFunctionsProperties().some(
      taskFunctionProperties => taskFunctionProperties.priority != null
    )
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

  private handleTask (workerNodeKey: number, task: Task<Data>): void {
    if (this.shallExecuteTask(workerNodeKey)) {
      this.executeTask(workerNodeKey, task)
    } else {
      this.enqueueTask(workerNodeKey, task)
    }
  }

  private handleTaskExecutionResponse (message: MessageValue<Response>): void {
    const { data, taskId, workerError } = message
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const promiseResponse = this.promiseResponseMap.get(taskId!)
    if (promiseResponse != null) {
      const { asyncResource, reject, resolve, workerNodeKey } = promiseResponse
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.promiseResponseMap.delete(taskId!)
      if (this.opts.enableTasksQueue === true && !this.destroying) {
        if (
          !this.isWorkerNodeBusy(workerNodeKey) &&
          this.tasksQueueSize(workerNodeKey) > 0
        ) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.executeTask(workerNodeKey, this.dequeueTask(workerNodeKey)!)
        }
        if (this.isWorkerNodeIdle(workerNodeKey)) {
          workerNode.emit('idle', {
            workerNodeKey,
          })
        }
      }
      // FIXME: cannot be theoretically undefined. Schedule in the next tick to avoid race conditions?
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      workerNode?.emit('taskFinished', taskId)
    }
  }

  private handleWorkerReadyResponse (message: MessageValue<Response>): void {
    const { ready, taskFunctionsProperties, workerId } = message
    if (ready == null || !ready) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Worker ${workerId?.toString()} failed to initialize`)
    }
    const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    const workerNode = this.workerNodes[workerNodeKey]
    workerNode.info.ready = ready
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
    if (
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
        .runTime.aggregate === true
    ) {
      workerNode.usage.runTime.aggregate = min(
        ...this.workerNodes.map(
          workerNode =>
            workerNode.usage.runTime.aggregate ?? Number.POSITIVE_INFINITY
        )
      )
    }
    if (
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
        .waitTime.aggregate === true
    ) {
      workerNode.usage.waitTime.aggregate = min(
        ...this.workerNodes.map(
          workerNode =>
            workerNode.usage.waitTime.aggregate ?? Number.POSITIVE_INFINITY
        )
      )
    }
    if (
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements().elu
        .aggregate === true
    ) {
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
    transferList?: readonly TransferListItem[]
  ): Promise<Response> {
    return await new Promise<Response>((resolve, reject) => {
      const timestamp = performance.now()
      const workerNodeKey = this.chooseWorkerNode(name)
      const task: Task<Data> = {
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.promiseResponseMap.set(task.taskId!, {
        reject,
        resolve,
        workerNodeKey,
        ...(this.emitter != null && {
          asyncResource: new AsyncResource('poolifier:task', {
            requireManualDestroy: true,
            triggerAsyncId: this.emitter.asyncId,
          }),
        }),
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

  private isWorkerNodeBusy (workerNodeKey: number): boolean {
    const workerNode = this.workerNodes[workerNodeKey]
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
    if (this.opts.enableTasksQueue === true) {
      return (
        workerNode.info.ready &&
        workerNode.usage.tasks.executing === 0 &&
        this.tasksQueueSize(workerNodeKey) === 0
      )
    }
    return workerNode.info.ready && workerNode.usage.tasks.executing === 0
  }

  private redistributeQueuedTasks (sourceWorkerNodeKey: number): void {
    if (sourceWorkerNodeKey === -1 || this.cannotStealTask()) {
      return
    }
    while (this.tasksQueueSize(sourceWorkerNodeKey) > 0) {
      const destinationWorkerNodeKey = this.workerNodes.reduce(
        (minWorkerNodeKey, workerNode, workerNodeKey, workerNodes) => {
          return sourceWorkerNodeKey !== workerNodeKey &&
            workerNode.info.ready &&
            workerNode.usage.tasks.queued <
              workerNodes[minWorkerNodeKey].usage.tasks.queued
            ? workerNodeKey
            : minWorkerNodeKey
        },
        0
      )
      this.handleTask(
        destinationWorkerNodeKey,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.dequeueTask(sourceWorkerNodeKey)!
      )
    }
  }

  /**
   * Removes the worker node from the pool worker nodes.
   * @param workerNode - The worker node.
   */
  private removeWorkerNode (workerNode: IWorkerNode<Worker, Data>): void {
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey !== -1) {
      this.workerNodes.splice(workerNodeKey, 1)
      this.workerChoiceStrategiesContext?.remove(workerNodeKey)
    }
    this.checkAndEmitEmptyEvent()
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
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      workerNode.getTaskFunctionWorkerUsage(
        taskName
      )!.tasks.sequentiallyStolen = 0
    }
  }

  private async sendKillMessageToWorker (workerNodeKey: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.workerNodes[workerNodeKey] == null) {
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
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `Kill message handling failed on worker ${message.workerId?.toString()}`
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
   * Sends the statistics message to worker given its worker node key.
   * @param workerNodeKey - The worker node key.
   */
  private sendStatisticsMessageToWorker (workerNodeKey: number): void {
    this.sendToWorker(workerNodeKey, {
      statistics: {
        elu:
          this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
            .elu.aggregate ?? false,
        runTime:
          this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
            .runTime.aggregate ?? false,
      },
    })
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
        const workerId = this.getWorkerInfo(workerNodeKey)?.id
        if (
          message.taskFunctionOperationStatus != null &&
          message.workerId === workerId
        ) {
          if (message.taskFunctionOperationStatus) {
            resolve(true)
          } else {
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
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  }' failed on worker ${errorResponse?.workerId?.toString()} with error: '${
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    errorResponse?.workerError?.message
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
      for (const workerNodeKey of this.workerNodes.keys()) {
        this.registerWorkerMessageListener(
          workerNodeKey,
          taskFunctionOperationsListener
        )
        this.sendToWorker(workerNodeKey, message)
      }
    })
  }

  private setTasksQueuePriority (workerNodeKey: number): void {
    this.workerNodes[workerNodeKey].setTasksQueuePriority(
      this.getTasksQueuePriority()
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
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the worker node shall update its task function worker usage, `false` otherwise.
   */
  private shallUpdateTaskFunctionWorkerUsage (workerNodeKey: number): boolean {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    return (
      workerInfo != null &&
      Array.isArray(workerInfo.taskFunctionsProperties) &&
      workerInfo.taskFunctionsProperties.length > 2
    )
  }

  /**
   * Starts the minimum number of workers.
   * @param initWorkerNodeUsage - Whether to initialize the worker node usage or not. @defaultValue false
   */
  private startMinimumNumberOfWorkers (initWorkerNodeUsage = false): void {
    if (this.minimumNumberOfWorkers === 0) {
      return
    }
    this.startingMinimumNumberOfWorkers = true
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
    this.startingMinimumNumberOfWorkers = false
  }

  private tasksQueueSize (workerNodeKey: number): number {
    return this.workerNodes[workerNodeKey].tasksQueueSize()
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
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
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
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ++workerNode.getTaskFunctionWorkerUsage(taskName)!.tasks.stolen
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
      this.workerNodes.map(async (_, workerNodeKey) => {
        await this.destroyWorkerNode(workerNodeKey)
      })
    )
    this.emitter?.emit(PoolEvents.destroy, this.info)
    this.emitter?.emitDestroy()
    this.readyEventEmitted = false
    this.backPressureEventEmitted = false
    delete this.startTimestamp
    this.destroying = false
    this.started = false
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
    transferList?: readonly TransferListItem[]
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
    if (transferList != null && !Array.isArray(transferList)) {
      throw new TypeError('transferList argument must be an array')
    }
    return await this.internalExecute(data, name, transferList)
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
    transferList?: readonly TransferListItem[]
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
    if (transferList != null && !Array.isArray(transferList)) {
      throw new TypeError('transferList argument must be an array')
    }
    if (!Array.isArray(data)) {
      data = [...data]
    }
    return await Promise.all(
      (data as Data[]).map(data =>
        this.internalExecute(data, name, transferList)
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
    this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
      this.getWorkerChoiceStrategies()
    )
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.sendStatisticsMessageToWorker(workerNodeKey)
    }
    return opResult
  }

  /** @inheritDoc */
  public async setDefaultTaskFunction (name: string): Promise<boolean> {
    return await this.sendTaskFunctionOperationToWorkers({
      taskFunctionOperation: 'default',
      taskFunctionProperties: buildTaskFunctionProperties(
        name,
        this.taskFunctions.get(name)
      ),
    })
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
    this.startMinimumNumberOfWorkers()
    this.startTimestamp = performance.now()
    this.starting = false
    this.started = true
  }

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
   * Whether the pool is empty or not.
   * @returns The pool emptiness boolean status.
   */
  protected get empty (): boolean {
    return (
      this.minimumNumberOfWorkers === 0 &&
      this.workerNodes.length === this.minimumNumberOfWorkers
    )
  }

  /**
   * Whether the pool is full or not.
   * @returns The pool fullness boolean status.
   */
  protected get full (): boolean {
    return (
      this.workerNodes.length >=
      (this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers)
    )
  }

  /** @inheritDoc */
  public get info (): PoolInfo {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      defaultStrategy: this.opts.workerChoiceStrategy!,
      maxSize: this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
      minSize: this.minimumNumberOfWorkers,
      ready: this.ready,
      started: this.started,
      strategyRetries: this.workerChoiceStrategiesContext?.retriesCount ?? 0,
      type: this.type,
      version,
      worker: this.worker,
      ...(this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
        .runTime.aggregate === true &&
        this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
          .waitTime.aggregate && {
        utilization: round(this.utilization),
      }),
      busyWorkerNodes: this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeBusy(workerNodeKey) ? accumulator + 1 : accumulator,
        0
      ),
      idleWorkerNodes: this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeIdle(workerNodeKey) ? accumulator + 1 : accumulator,
        0
      ),
      workerNodes: this.workerNodes.length,
      ...(this.opts.enableTasksQueue === true && {
        stealingWorkerNodes: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            workerNode.info.continuousStealing ||
            workerNode.info.backPressureStealing
              ? accumulator + 1
              : accumulator,
          0
        ),
      }),
      ...(this.opts.enableTasksQueue === true && {
        backPressureWorkerNodes: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            workerNode.info.backPressure ? accumulator + 1 : accumulator,
          0
        ),
      }),
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
        ),
      }),
      ...(this.opts.enableTasksQueue === true && {
        maxQueuedTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + (workerNode.usage.tasks.maxQueued ?? 0),
          0
        ),
      }),
      ...(this.opts.enableTasksQueue === true && {
        backPressure: this.backPressure,
      }),
      ...(this.opts.enableTasksQueue === true && {
        stolenTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + workerNode.usage.tasks.stolen,
          0
        ),
      }),
      failedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.failed,
        0
      ),
      ...(this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
        .runTime.aggregate === true && {
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
          ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
            .runTime.average && {
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
          ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
            .runTime.median && {
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
      ...(this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
        .waitTime.aggregate === true && {
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
          ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
            .waitTime.average && {
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
          ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
            .waitTime.median && {
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
      ...(this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
        .elu.aggregate === true && {
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
            ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
              .elu.average && {
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
            ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
              .elu.median && {
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
            ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
              .elu.average && {
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
            ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
              .elu.median && {
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
   * The pool type.
   *
   * If it is `'dynamic'`, it provides the `max` property.
   */
  protected abstract get type (): PoolType

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
   * The worker type.
   */
  protected abstract get worker (): WorkerType
}
