import EventEmitterAsyncResource from 'node:events'
import type {
  ErrorHandler,
  ExitHandler,
  IWorker,
  MessageHandler,
  OnlineHandler,
  WorkerNode
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
 * Enumeration of worker types.
 */
export const WorkerTypes = Object.freeze({
  cluster: 'cluster',
  thread: 'thread'
} as const)

/**
 * Worker type.
 */
export type WorkerType = keyof typeof WorkerTypes

/**
 * Pool events emitter.
 */
export class PoolEmitter extends EventEmitterAsyncResource {}

/**
 * Enumeration of pool events.
 */
export const PoolEvents = Object.freeze({
  full: 'full',
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
  type: PoolType
  worker: WorkerType
  minSize: number
  maxSize: number
  workerNodes: number
  idleWorkerNodes: number
  busyWorkerNodes: number
  executedTasks: number
  executingTasks: number
  queuedTasks: number
  maxQueuedTasks: number
  failedTasks: number
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
  concurrency?: number
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
  readonly workerNodes: Array<WorkerNode<Worker, Data>>
  /**
   * Emitter on which events can be listened to.
   *
   * Events that can currently be listened to:
   *
   * - `'full'`: Emitted when the pool is dynamic and full.
   * - `'busy'`: Emitted when the pool is busy.
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
  execute: (data?: Data, name?: string) => Promise<Response>
  /**
   * Terminate every current worker in this pool.
   */
  destroy: () => Promise<void>
  /**
   * Sets the worker choice strategy in this pool.
   *
   * @param workerChoiceStrategy - The worker choice strategy.
   * @param workerChoiceStrategyOptions - The worker choice strategy options.
   */
  setWorkerChoiceStrategy: (
    workerChoiceStrategy: WorkerChoiceStrategy,
    workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  ) => void
  /**
   * Sets the worker choice strategy options in this pool.
   *
   * @param workerChoiceStrategyOptions - The worker choice strategy options.
   */
  setWorkerChoiceStrategyOptions: (
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions
  ) => void
  /**
   * Enables/disables the worker tasks queue in this pool.
   *
   * @param enable - Whether to enable or disable the worker tasks queue.
   * @param tasksQueueOptions - The worker tasks queue options.
   */
  enableTasksQueue: (
    enable: boolean,
    tasksQueueOptions?: TasksQueueOptions
  ) => void
  /**
   * Sets the worker tasks queue options in this pool.
   *
   * @param tasksQueueOptions - The worker tasks queue options.
   */
  setTasksQueueOptions: (tasksQueueOptions: TasksQueueOptions) => void
}
