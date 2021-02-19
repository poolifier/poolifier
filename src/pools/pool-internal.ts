import type { AbstractPool, IWorker } from './abstract-pool'

/**
 * Internal contract definition for a poolifier pool.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 */
export type IPoolInternal<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> = AbstractPool<Worker, Data, Response>

/**
 * Internal contract definition for a poolifier dynamic pool.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 */
export interface IPoolDynamicInternal<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> extends IPoolInternal<Worker, Data, Response> {
  /**
   * Maximum number of workers that can be created by this pool.
   */
  readonly max: number
}
