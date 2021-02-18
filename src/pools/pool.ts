import { JSONValue } from '../utility-types'
import { AbstractPool, IWorker } from './abstract-pool'

/**
 * Contract definition for a poolifier pool.
 *
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 */
export interface IPool<
  Worker extends IWorker,
  Data extends JSONValue = JSONValue,
  Response extends JSONValue = JSONValue
> extends AbstractPool<Worker, Data, Response> {
  /**
   * Perform the task specified in the constructor with the data parameter.
   *
   * @param data The input for the specified task.
   * @returns Promise that will be resolved when the task is successfully completed.
   */
  execute(data: Data): Promise<Response>
  /**
   * Shut down every current worker in this pool.
   */
  destroy(): Promise<void>
}
