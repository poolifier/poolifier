/**
 * Enumeration of kill behaviors.
 */
export const KillBehaviors = Object.freeze({
  /**
   * If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still executing or queued, then the worker **wont** be deleted.
   */
  SOFT: 'SOFT',
  /**
   * If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still executing or queued, then the worker will be deleted.
   */
  HARD: 'HARD'
} as const)

/**
 * Kill behavior.
 */
export type KillBehavior = keyof typeof KillBehaviors

/**
 * Handler called when a worker is killed.
 */
export type KillHandler = () => void | Promise<void>

/**
 * Options for workers.
 */
export interface WorkerOptions {
  /**
   * `killBehavior` dictates if your worker will be deleted in case a task is active on it.
   *
   * - SOFT: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still executing or queued, then the worker **won't** be deleted.
   * - HARD: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still executing or queued, then the worker will be deleted.
   *
   * This option only apply to the newly created workers.
   *
   * @defaultValue KillBehaviors.SOFT
   */
  killBehavior?: KillBehavior
  /**
   * Maximum waiting time in milliseconds for tasks on newly created workers.
   *
   * After this time, newly created workers will be terminated.
   * The last active time of your worker will be updated when it terminates a task.
   *
   * - If `killBehavior` is set to `KillBehaviors.HARD` this value represents also the timeout for the tasks that you submit to the pool,
   *   when this timeout expires your tasks is interrupted before completion and removed. The worker is killed if is not part of the minimum size of the pool.
   * - If `killBehavior` is set to `KillBehaviors.SOFT` your tasks have no timeout and your workers will not be terminated until your task is completed.
   *
   * @defaultValue 60000
   */
  maxInactiveTime?: number
  /**
   * The function to call when a worker is killed.
   *
   * @defaultValue `() => {}`
   */
  killHandler?: KillHandler
  /**
   * Whether your worker will perform asynchronous or not.
   *
   * @defaultValue false
   * @deprecated This option will be removed in the next major version.
   */
  async?: boolean
}
