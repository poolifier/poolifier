import EventEmitter from 'events'
import type { MessageValue } from '../utility-types'
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
   * Maximum number of workers that can be created by this pool.
   */
  readonly max?: number

  /**
   * Creates a new worker for this pool and sets it up completely.
   *
   * @returns New, completely set up worker.
   */
  createAndSetupWorker(): Worker

  /**
   * Shut down given worker.
   *
   * @param worker A worker within `workers`.
   */
  destroyWorker(worker: Worker): void | Promise<void>

  /**
   * Register a listener callback on a given worker.
   *
   * @param worker A worker.
   * @param listener A message listener callback.
   */
  registerWorkerMessageListener<Message extends Data | Response>(
    worker: Worker,
    listener: (message: MessageValue<Message>) => void
  ): void
}
