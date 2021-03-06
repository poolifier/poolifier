import EventEmitter from 'events'
import type { IWorker } from './abstract-pool'
import type { IPool } from './pool'

/**
 * Pool types.
 */
export enum PoolType {
  FIXED = 'fixed',
  DYNAMIC = 'dynamic'
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
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> extends IPool<Data, Response> {
  /**
   * List of currently available workers.
   */
  readonly workers: Worker[]

  /**
   * The tasks map.
   *
   * - `key`: The `Worker`
   * - `value`: Number of tasks currently in progress on the worker.
   */
  readonly tasks: Map<Worker, number>

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
   * Find a tasks map entry with a free worker based on the number of tasks the worker has applied.
   *
   * If an entry is found with a worker that has `0` tasks, it is detected as free.
   *
   * If no tasks map entry with a free worker was found, `false` will be returned.
   *
   * @returns A tasks map entry with a free worker if there was one, otherwise `false`.
   */
  findFreeTasksMapEntry(): [Worker, number] | false
}
