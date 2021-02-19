import type { IWorker } from './abstract-pool'
import type { IPool } from './pool'

/**
 * Contract definition for a dynamic poolifier pool.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 */
export interface IDynamicPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> extends IPool<Worker, Data, Response> {
  /**
   * Maximum number of workers that can be created by this pool.
   */
  readonly max: number
}
