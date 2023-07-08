import { EventEmitter } from 'node:events'
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
  full: 'full',
  ready: 'ready',
  busy: 'busy',
  error: 'error',
  taskError: 'taskError'
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
  readonly ready: boolean
  readonly strategy: WorkerChoiceStrategy
  readonly minSize: number
  readonly maxSize: number
  /** Pool utilization ratio. */
  readonly utilization?: number
  /** Pool total worker nodes */
  readonly workerNodes: number
  /** Pool idle worker nodes */
  readonly idleWorkerNodes: number
  /** Pool busy worker nodes */
  readonly busyWorkerNodes: number
  readonly executedTasks: number
  readonly executingTasks: number
  readonly queuedTasks: number
  readonly maxQueuedTasks: number
  readonly failedTasks: number
  readonly runTime?: {
    readonly minimum: number
    readonly maximum: number
    readonly average: number
    readonly median?: number
  }
  readonly waitTime?: {
    readonly minimum: number
    readonly maximum: number
    readonly average: number
    readonly median?: number
  }
}

/**
 * Worker tasks queue options.
 */
export interface TasksQueueOptions {
  /**
   * Maximum number of tasks that can be executed concurrently on a worker.
   *
   * @defaultValue 1
   */
  readonly concurrency?: number
}

/**
 * Options for a poolifier pool.
 *
 * @typeParam Worker - Type of worker.
 */
export interface PoolOptions<Worker extends IWorker> {
  /**
   * A function that will listen for message event on each worker.
   */
  messageHandler?: MessageHandler<Worker>
  /**
   * A function that will listen for error event on each worker.
   */
  errorHandler?: ErrorHandler<Worker>
  /**
   * A function that will listen for online event on each worker.
   */
  onlineHandler?: OnlineHandler<Worker>
  /**
   * A function that will listen for exit event on each worker.
   */
  exitHandler?: ExitHandler<Worker>
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
   * Pool worker tasks queue.
   *
   * @defaultValue false
   */
  enableTasksQueue?: boolean
  /**
   * Pool worker tasks queue options.
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
   */
  readonly workerNodes: Array<IWorkerNode<Worker, Data>>
  /**
   * Emitter on which events can be listened to.
   *
   * Events that can currently be listened to:
   *
   * - `'full'`: Emitted when the pool is dynamic and the number of workers created has reached the maximum size expected.
   * - `'ready'`: Emitted when the number of workers created in the pool has reached the minimum size expected and are ready.
   * - `'busy'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are executing at least one task.
   * - `'error'`: Emitted when an uncaught error occurs.
   * - `'taskError'`: Emitted when an error occurs while executing a task.
   */
  readonly emitter?: PoolEmitter
  /**
   * Executes the specified function in the worker constructor with the task data input parameter.
   *
   * @param data - The task input data for the specified worker function. This can only be structured-cloneable data.
   * @param name - The name of the worker function to execute. If not specified, the default worker function will be executed.
   * @returns Promise that will be fulfilled when the task is completed.
   */
  readonly execute: (data?: Data, name?: string) => Promise<Response>
  /**
   * Terminates every current worker in this pool.
   */
  readonly destroy: () => Promise<void>
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
   * Enables/disables the worker tasks queue in this pool.
   *
   * @param enable - Whether to enable or disable the worker tasks queue.
   * @param tasksQueueOptions - The worker tasks queue options.
   */
  readonly enableTasksQueue: (
    enable: boolean,
    tasksQueueOptions?: TasksQueueOptions
  ) => void
  /**
   * Sets the worker tasks queue options in this pool.
   *
   * @param tasksQueueOptions - The worker tasks queue options.
   */
  readonly setTasksQueueOptions: (tasksQueueOptions: TasksQueueOptions) => void
}
