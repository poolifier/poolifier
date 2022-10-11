import type {
  ErrorHandler,
  ExitHandler,
  MessageHandler,
  OnlineHandler
} from './pool-worker'
import type { WorkerChoiceStrategy } from './selection-strategies/selection-strategies-types'

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
   * The work choice strategy to use in this pool.
   */
  workerChoiceStrategy?: WorkerChoiceStrategy
  /**
   * Pool events emission.
   *
   * @default true
   */
  enableEvents?: boolean
}

/**
 * Contract definition for a poolifier pool.
 *
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export interface IPool<Data = unknown, Response = unknown> {
  /**
   * Performs the task specified in the constructor with the data parameter.
   *
   * @param data The input for the specified task. This can only be serializable data.
   * @returns Promise that will be resolved when the task is successfully completed.
   */
  execute(data: Data): Promise<Response>
  /**
   * Shutdowns every current worker in this pool.
   */
  destroy(): Promise<void>
  /**
   * Sets the worker choice strategy in this pool.
   *
   * @param workerChoiceStrategy The worker choice strategy.
   */
  setWorkerChoiceStrategy(workerChoiceStrategy: WorkerChoiceStrategy): void
}
