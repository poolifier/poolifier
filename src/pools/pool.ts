import type { IWorker } from './abstract-pool'
import { AbstractPool } from './abstract-pool'

/**
 * Contract definition for a poolifier pool.
 *
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export interface IPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> extends AbstractPool<Worker, Data, Response> {
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
}
