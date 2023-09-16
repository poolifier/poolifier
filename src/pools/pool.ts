import { EventEmitter } from 'node:events'
import { type TransferListItem } from 'node:worker_threads'
import type {
  ErrorHandler,
  ExitHandler,
  IWorker,
  IWorkerNode,
  MessageHandler,
  OnlineHandler,
  WorkerType
} from './worker'
import type {
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions
} from './selection-strategies/selection-strategies-types'

/**
 * Enumeration of pool types.
 */
export const PoolTypes = Object.freeze({
  /**
   * Fixed pool type.
   */
  fixed: 'fixed',
  /**
   * Dynamic pool type.
   */
  dynamic: 'dynamic'
} as const)

/**
 * Pool type.
 */
export type PoolType = keyof typeof PoolTypes

/**
 * Pool events emitter.
 */
export class PoolEmitter extends EventEmitter {}

/**
 * Enumeration of pool events.
 */
export const PoolEvents = Object.freeze({
  ready: 'ready',
  busy: 'busy',
  full: 'full',
  destroy: 'destroy',
  error: 'error',
  taskError: 'taskError',
  backPressure: 'backPressure'
} as const)

/**
 * Pool event.
 */
export type PoolEvent = keyof typeof PoolEvents

/**
 * Pool information.
 */
export interface PoolInfo {
  readonly version: string
  readonly type: PoolType
  readonly worker: WorkerType
  readonly started: boolean
  readonly ready: boolean
  readonly strategy: WorkerChoiceStrategy
  readonly minSize: number
  readonly maxSize: number
  /** Pool utilization. */
  readonly utilization?: number
  /** Pool total worker nodes. */
  readonly workerNodes: number
  /** Pool idle worker nodes. */
  readonly idleWorkerNodes: number
  /** Pool busy worker nodes. */
  readonly busyWorkerNodes: number
  readonly executedTasks: number
  readonly executingTasks: number
  readonly queuedTasks?: number
  readonly maxQueuedTasks?: number
  readonly backPressure?: boolean
  readonly stolenTasks?: number
  readonly failedTasks: number
  readonly runTime?: {
    readonly minimum: number
    readonly maximum: number
    readonly average?: number
    readonly median?: number
  }
  readonly waitTime?: {
    readonly minimum: number
    readonly maximum: number
    readonly average?: number
    readonly median?: number
  }
}

/**
 * Worker node tasks queue options.
 */
export interface TasksQueueOptions {
  /**
   * Maximum tasks queue size per worker node flagging it as back pressured.
   *
   * @defaultValue (pool maximum size)^2
   */
  readonly size?: number
  /**
   * Maximum number of tasks that can be executed concurrently on a worker node.
   *
   * @defaultValue 1
   */
  readonly concurrency?: number
  /**
   * Whether to enable task stealing.
   *
   * @defaultValue true
   */
  readonly taskStealing?: boolean
  /**
   * Whether to enable tasks stealing on back pressure.
   *
   * @defaultValue true
   */
  readonly tasksStealingOnBackPressure?: boolean
}

/**
 * Options for a poolifier pool.
 *
 * @typeParam Worker - Type of worker.
 */
export interface PoolOptions<Worker extends IWorker> {
  /**
   * A function that will listen for online event on each worker.
   */
  onlineHandler?: OnlineHandler<Worker>
  /**
   * A function that will listen for message event on each worker.
   */
  messageHandler?: MessageHandler<Worker>
  /**
   * A function that will listen for error event on each worker.
   */
  errorHandler?: ErrorHandler<Worker>
  /**
   * A function that will listen for exit event on each worker.
   */
  exitHandler?: ExitHandler<Worker>
  /**
   * Whether to start the minimum number of workers at pool initialization.
   *
   * @defaultValue true
   */
  startWorkers?: boolean
  /**
   * The worker choice strategy to use in this pool.
   *
   * @defaultValue WorkerChoiceStrategies.ROUND_ROBIN
   */
  workerChoiceStrategy?: WorkerChoiceStrategy
  /**
   * The worker choice strategy options.
   */
  workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  /**
   * Restart worker on error.
   */
  restartWorkerOnError?: boolean
  /**
   * Pool events emission.
   *
   * @defaultValue true
   */
  enableEvents?: boolean
  /**
   * Pool worker node tasks queue.
   *
   * @defaultValue false
   */
  enableTasksQueue?: boolean
  /**
   * Pool worker node tasks queue options.
   */
  tasksQueueOptions?: TasksQueueOptions
}

/**
 * Contract definition for a poolifier pool.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export interface IPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> {
  /**
   * Pool information.
   */
  readonly info: PoolInfo
  /**
   * Pool worker nodes.
   *
   * @internal
   */
  readonly workerNodes: Array<IWorkerNode<Worker, Data>>
  /**
   * Whether the worker node has back pressure (i.e. its tasks queue is full).
   *
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the worker node has back pressure, `false` otherwise.
   * @internal
   */
  readonly hasWorkerNodeBackPressure: (workerNodeKey: number) => boolean
  /**
   * Emitter on which events can be listened to.
   *
   * Events that can currently be listened to:
   *
   * - `'ready'`: Emitted when the number of workers created in the pool has reached the minimum size expected and are ready.
   * - `'busy'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are executing concurrently their tasks quota.
   * - `'full'`: Emitted when the pool is dynamic and the number of workers created has reached the maximum size expected.
   * - `'destroy'`: Emitted when the pool is destroyed.
   * - `'error'`: Emitted when an uncaught error occurs.
   * - `'taskError'`: Emitted when an error occurs while executing a task.
   * - `'backPressure'`: Emitted when all worker nodes have back pressure (i.e. their tasks queue is full: queue size \>= maximum queue size).
   */
  readonly emitter?: PoolEmitter
  /**
   * Executes the specified function in the worker constructor with the task data input parameter.
   *
   * @param data - The optional task input data for the specified task function. This can only be structured-cloneable data.
   * @param name - The optional name of the task function to execute. If not specified, the default task function will be executed.
   * @param transferList - An optional array of transferable objects to transfer ownership of. Ownership of the transferred objects is given to the pool's worker_threads worker and they should not be used in the main thread afterwards.
   * @returns Promise that will be fulfilled when the task is completed.
   */
  readonly execute: (
    data?: Data,
    name?: string,
    transferList?: TransferListItem[]
  ) => Promise<Response>
  /**
   * Starts the minimum number of workers in this pool.
   */
  readonly start: () => void
  /**
   * Terminates all workers in this pool.
   */
  readonly destroy: () => Promise<void>
  /**
   * Lists the names of task function available in this pool.
   *
   * @returns The names of task function available in this pool.
   */
  readonly listTaskFunctions: () => string[]
  /**
   * Sets the worker choice strategy in this pool.
   *
   * @param workerChoiceStrategy - The worker choice strategy.
   * @param workerChoiceStrategyOptions - The worker choice strategy options.
   */
  readonly setWorkerChoiceStrategy: (
    workerChoiceStrategy: WorkerChoiceStrategy,
    workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  ) => void
  /**
   * Sets the worker choice strategy options in this pool.
   *
   * @param workerChoiceStrategyOptions - The worker choice strategy options.
   */
  readonly setWorkerChoiceStrategyOptions: (
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions
  ) => void
  /**
   * Enables/disables the worker node tasks queue in this pool.
   *
   * @param enable - Whether to enable or disable the worker node tasks queue.
   * @param tasksQueueOptions - The worker node tasks queue options.
   */
  readonly enableTasksQueue: (
    enable: boolean,
    tasksQueueOptions?: TasksQueueOptions
  ) => void
  /**
   * Sets the worker node tasks queue options in this pool.
   *
   * @param tasksQueueOptions - The worker node tasks queue options.
   */
  readonly setTasksQueueOptions: (tasksQueueOptions: TasksQueueOptions) => void
}
