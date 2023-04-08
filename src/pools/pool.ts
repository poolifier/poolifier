import EventEmitter from 'node:events'
import type {
  ErrorHandler,
  ExitHandler,
  MessageHandler,
  OnlineHandler
} from './worker'
import type { WorkerChoiceStrategy } from './selection-strategies/selection-strategies-types'

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
 * Options for a poolifier pool.
 */
export interface PoolOptions<Worker> {
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
   * Pool events emission.
   *
   * @defaultValue true
   */
  enableEvents?: boolean
}

/**
 * Contract definition for a poolifier pool.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export interface IPool<Data = unknown, Response = unknown> {
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
   * Performs the task specified in the constructor with the data parameter.
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
