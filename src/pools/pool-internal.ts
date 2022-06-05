import EventEmitter from 'events'
import type { AbstractPoolWorker } from './abstract-pool-worker'
import type { IPool } from './pool'

/**
 * Pool types.
 */
export enum PoolType {
  FIXED = 'fixed',
  DYNAMIC = 'dynamic'
}

/**
 * Tasks usage statistics.
 */
export interface TasksUsage {
  run: number
  running: number
  runTime: number
  avgRunTime: number
}

/**
 * Internal poolifier pool emitter.
 */
export class PoolEmitter extends EventEmitter {}

/**
 * Internal contract definition for a poolifier pool.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 */
export interface IPoolInternal<
  Worker extends AbstractPoolWorker,
  Data = unknown,
  Response = unknown
> extends IPool<Data, Response> {
  /**
   * List of currently available workers.
   */
  readonly workers: Worker[]

  /**
   * Emitter on which events can be listened to.
   *
   * Events that can currently be listened to:
   *
   * - `'busy'`
   */
  readonly emitter?: PoolEmitter

  /**
   * Pool type.
   *
   * If it is `'dynamic'`, it provides the `max` property.
   */
  readonly type: PoolType

  /**
   * Maximum number of workers that can be created by this pool.
   */
  readonly max?: number

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
   * Find a free worker based on the number of tasks the worker has applied.
   *
   * If a worker is found with `0` running tasks, it is detected as free and returned.
   *
   * If no free worker is found, `false` is returned.
   *
   * @returns A free worker if there is one, otherwise `false`.
   */
  findFreeWorker(): Worker | false

  /**
   * Get worker index.
   *
   * @param worker The worker.
   */
  getWorkerIndex(worker: Worker): number

  /**
   * Get worker running tasks.
   *
   * @param worker The worker.
   */
  getWorkerRunningTasks(worker: Worker): number

  /**
   * Get worker average tasks run time.
   *
   * @param worker The worker.
   */
  getWorkerAverageTasksRunTime(worker: Worker): number
}
