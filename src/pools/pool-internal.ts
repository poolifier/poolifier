import EventEmitter from 'events'
import type { IWorker } from './abstract-pool'
import type { IPool } from './pool'

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
   * - `'FullPool'`
   */
  readonly emitter: PoolEmitter

  /**
   * Whether the pool is dynamic or not.
   *
   * If it is dynamic, it provides the `max` property.
   */
  readonly dynamic: boolean

  /**
   * Maximum number of workers that can be created by this pool.
   */
  readonly max?: number
}
