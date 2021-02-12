/**
 * Contract definition for a poolifier pool.
 *
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 */
export interface IPool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Response = any
> {
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
