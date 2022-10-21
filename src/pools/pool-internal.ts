import type { IPool } from './pool'
import type { IPoolWorker } from './pool-worker'

/**
 * Internal pool types.
 */
export enum PoolType {
  FIXED = 'fixed',
  DYNAMIC = 'dynamic'
}

/**
 * Internal tasks usage statistics.
 */
export interface TasksUsage {
  run: number
  running: number
  runTime: number
  avgRunTime: number
}

/**
 * Internal contract definition for a poolifier pool.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 */
export interface IPoolInternal<
  Worker extends IPoolWorker,
  Data = unknown,
  Response = unknown
> extends IPool<Data, Response> {
  /**
   * List of currently available workers.
   */
  readonly workers: Worker[]

  // /**
  //  * The workers tasks usage map.
  //  *
  //  *  `key`: The `Worker`
  //  *  `value`: Worker tasks usage statistics.
  //  */
  // readonly workersTasksUsage: Map<Worker, TasksUsage>

  /**
   * Pool type.
   *
   * If it is `'dynamic'`, it provides the `max` property.
   */
  readonly type: PoolType

  /**
   * Whether the pool is busy or not.
   *
   * The pool busyness boolean status.
   */
  readonly busy: boolean

  /**
   * Number of tasks currently concurrently running.
   */
  readonly numberOfRunningTasks: number

  /**
   * Finds a free worker based on the number of tasks the worker has applied.
   *
   * If a worker is found with `0` running tasks, it is detected as free and returned.
   *
   * If no free worker is found, `false` is returned.
   *
   * @returns A free worker if there is one, otherwise `false`.
   */
  findFreeWorker(): Worker | false

  /**
   * Gets worker index.
   *
   * @param worker The worker.
   * @returns The worker index.
   */
  getWorkerIndex(worker: Worker): number

  /**
   * Gets worker running tasks.
   *
   * @param worker The worker.
   * @returns The number of tasks currently running on the worker.
   */
  getWorkerRunningTasks(worker: Worker): number | undefined

  /**
   * Gets worker average tasks runtime.
   *
   * @param worker The worker.
   * @returns The average tasks runtime on the worker.
   */
  getWorkerAverageTasksRunTime(worker: Worker): number | undefined
}
