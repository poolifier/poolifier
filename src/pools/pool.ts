import type { WorkerChoiceStrategy } from './selection-strategies'

/**
 * Contract definition for a poolifier pool.
 *
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export interface IPool<Data = unknown, Response = unknown> {
  /**
   * Perform the task specified in the constructor with the data parameter.
   *
   * @param data The input for the specified task. This can only be serializable data.
   * @returns Promise that will be resolved when the task is successfully completed.
   */
  execute(data: Data): Promise<Response>
  /**
   * Shut down every current worker in this pool.
   */
  destroy(): Promise<void>
  /**
   * Set the worker choice strategy in this pool.
   *
   * @param workerChoiceStrategy The worker choice strategy.
   */
  setWorkerChoiceStrategy(workerChoiceStrategy: WorkerChoiceStrategy): void
}
