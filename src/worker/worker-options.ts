export interface WorkerOptions {
  /**
   * Max time to wait tasks to work on (in ms), after this period the new worker threads will die.
   *
   * @default 60.000 ms
   */
  maxInactiveTime?: number
  /**
   * `true` if your function contains async pieces, else `false`.
   *
   * @default false
   */
  async?: boolean
}
