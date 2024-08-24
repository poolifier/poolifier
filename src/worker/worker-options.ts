/**
 * Enumeration of kill behaviors.
 */
export const KillBehaviors: Readonly<{ HARD: 'HARD'; SOFT: 'SOFT' }> =
  Object.freeze({
    /**
     * If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but the worker is stealing tasks or a task is executing or queued, then the worker will be deleted.
     */
    HARD: 'HARD',
    /**
     * If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but the worker is stealing tasks or a task is executing or queued, then the worker **wont** be deleted.
     */
    SOFT: 'SOFT',
  } as const)

/**
 * Kill behavior.
 */
export type KillBehavior = keyof typeof KillBehaviors

/**
 * Handler called when a worker is killed.
 */
export type KillHandler = () => Promise<void> | void

/**
 * Options for workers.
 */
export interface WorkerOptions {
  /**
   * `killBehavior` dictates if your worker will be deleted in case a task is active on it.
   *
   * - SOFT: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but the worker is stealing tasks or a task is executing or queued, then the worker **won't** be deleted.
   * - HARD: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but the worker is stealing tasks or a task is executing or queued, then the worker will be deleted.
   *
   * This option only apply to the newly created workers.
   * @defaultValue KillBehaviors.SOFT
   */
  killBehavior?: KillBehavior
  /**
   * The function to call when a worker is killed.
   * @defaultValue `() => {}`
   */
  killHandler?: KillHandler
  /**
   * Maximum waiting time in milliseconds for tasks on newly created workers. It must be greater or equal than 5.
   *
   * After this time, newly created workers will be terminated.
   * The last active time of your worker will be updated when it terminates a task.
   *
   * - If `killBehavior` is set to `KillBehaviors.HARD` this value represents also the timeout for the tasks that you submit to the pool,
   * when this timeout expires your tasks is interrupted before completion and removed. The worker is killed if is not part of the minimum size of the pool.
   * - If `killBehavior` is set to `KillBehaviors.SOFT` your tasks have no timeout and your workers will not be terminated until your task is completed.
   * @defaultValue 60000
   */
  maxInactiveTime?: number
}
