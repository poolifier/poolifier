/**
 * Enumeration of kill behaviors.
 */
export const KillBehaviors = Object.freeze({
  /**
   * If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still running, then the worker **wont** be deleted.
   */
  SOFT: 'SOFT',
  /**
   * If `lastActiveTime` is greater than `maxInactiveTime` but a task is still running, then the worker will be deleted.
   */
  HARD: 'HARD'
} as const)

/**
 * Kill behavior.
 */
export type KillBehavior = keyof typeof KillBehaviors

/**
 * Detects whether the given value is a kill behavior or not.
 *
 * @template KB Which specific KillBehavior to test against.
 * @param killBehavior Which kind of kill behavior to detect.
 * @param value Any value.
 * @returns `true` if `value` was strictly equals to `killBehavior`, otherwise `false`.
 */
export function isKillBehavior<KB extends KillBehavior> (
  killBehavior: KB,
  value: unknown
): value is KB {
  return value === killBehavior
}

/**
 * Options for workers.
 */
export interface WorkerOptions {
  /**
   * Maximum waiting time in milliseconds for tasks.
   *
   * After this time, newly created workers will be terminated.
   * The last active time of your worker unit will be updated when a task is submitted to a worker or when a worker terminate a task.
   *
   * - If `killBehavior` is set to `KillBehaviors.HARD` this value represents also the timeout for the tasks that you submit to the pool,
   *   when this timeout expires your tasks is interrupted and the worker is killed if is not part of the minimum size of the pool.
   * - If `killBehavior` is set to `KillBehaviors.SOFT` your tasks have no timeout and your workers will not be terminated until your task is completed.
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
  /**
   * `killBehavior` dictates if your async unit (worker/process) will be deleted in case that a task is active on it.
   *
   * - SOFT: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still running, then the worker **won't** be deleted.
   * - HARD: If `lastActiveTime` is greater than `maxInactiveTime` but a task is still running, then the worker will be deleted.
   *
   * This option only apply to the newly created workers.
   *
   * @default KillBehaviors.SOFT
   */
  killBehavior?: KillBehavior
}
