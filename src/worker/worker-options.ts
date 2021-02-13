/**
 * Options for workers.
 */
export interface WorkerOptions {
  /**
   * Maximum waiting time in milliseconds for tasks.
   *
   * After this time, newly created workers will be terminated.
   *
   * @default 60.000 ms
   */
  maxInactiveTime?: number
  /**
   * Whether your worker will perform asynchronous or not.
   *
   * @default false
   */
  async?: boolean
}
