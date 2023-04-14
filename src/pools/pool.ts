import EventEmitter from 'node:events'
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
 * Pool types.
 *
 * @enum
 * @internal
 */
export enum PoolType {
  /**
   * Fixed pool type.
   */
  FIXED = 'fixed',
  /**
   * Dynamic pool type.
   */
  DYNAMIC = 'dynamic'
}

/**
 * Pool events emitter.
 */
export class PoolEmitter extends EventEmitter {}

/**
 * Enumeration of pool events.
 */
export const PoolEvents = Object.freeze({
  full: 'full',
  busy: 'busy'
} as const)

/**
 * Pool event.
 */
export type PoolEvent = keyof typeof PoolEvents

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
   */
  workerChoiceStrategy?: WorkerChoiceStrategy
  /**
   * The worker choice strategy options.
   */
  workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  /**
   * Pool events emission.
   *
   * @defaultValue true
   */
  enableEvents?: boolean
  /**
   * Pool worker tasks queue.
   *
   * @experimental
   * @defaultValue false
   */
  enableTasksQueue?: boolean
  /**
   * Pool worker tasks queue options.
   *
   * @experimental
   */
  tasksQueueOptions?: TasksQueueOptions
}

/**
 * Contract definition for a poolifier pool.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export interface IPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> {
  /**
   * Pool type.
   *
   * If it is `'dynamic'`, it provides the `max` property.
   */
  readonly type: PoolType
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
   */
  readonly emitter?: PoolEmitter
  /**
   * Finds a free worker node key based on the number of tasks the worker has applied.
   *
   * If a worker is found with `0` running tasks, it is detected as free and its worker node key is returned.
   *
   * If no free worker is found, `-1` is returned.
   *
   * @returns A worker node key if there is one, `-1` otherwise.
   */
  findFreeWorkerNodeKey: () => number
  /**
   * Execute the function specified in the constructor with the task data parameter.
   *
   * @param data - The input for the specified task. This can only be serializable data.
   * @returns Promise that will be resolved when the task is successfully completed.
   */
  execute: (data: Data) => Promise<Response>
  /**
   * Shutdowns every current worker in this pool.
   */
  destroy: () => Promise<void>
  /**
   * Sets the worker choice strategy in this pool.
   *
   * @param workerChoiceStrategy - The worker choice strategy.
   */
  setWorkerChoiceStrategy: (workerChoiceStrategy: WorkerChoiceStrategy) => void
}
