/**
 * Contract definition for a poolifier pool.
 *
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 */
export interface IPool<Data = unknown, Response = unknown> {
  /**
   * Shut down every current worker in this pool.
   */
  destroy(): Promise<void>
  /**
   * Perform the task specified in the constructor with the data parameter.
   *
   * @param data The input for the specified task.
   * @returns Promise that will be resolved when the task is successfully completed.
   */
  execute(data: Data): Promise<Response>
}
