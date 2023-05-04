import type { Worker as ClusterWorker } from 'node:cluster'
import type { MessagePort } from 'node:worker_threads'
import type { KillBehavior } from './worker/worker-options'
import type { IWorker, Task } from './pools/worker'

/**
 * Make all properties in T non-readonly.
 *
 * @typeParam T - Type in which properties will be non-readonly.
 */
export type Draft<T> = { -readonly [P in keyof T]?: T[P] }

/**
 * Message object that is passed between main worker and worker.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam MainWorker - Type of main worker.
 * @internal
 */
export interface MessageValue<
  Data = unknown,
  MainWorker extends ClusterWorker | MessagePort | unknown = unknown
> extends Task<Data> {
  /**
   * Kill code.
   */
  readonly kill?: KillBehavior | 1
  /**
   * Error.
   */
  readonly error?: string
  /**
   * Runtime.
   */
  readonly runTime?: number
  /**
   * Reference to main worker.
   */
  readonly parent?: MainWorker
}

/**
 * Worker synchronous function that can be executed.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export type WorkerSyncFunction<Data = unknown, Response = unknown> = (
  data?: Data
) => Response
/**
 * Worker asynchronous function that can be executed.
 * This function must return a promise.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export type WorkerAsyncFunction<Data = unknown, Response = unknown> = (
  data?: Data
) => Promise<Response>
/**
 * Worker function that can be executed.
 * This function can be synchronous or asynchronous.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export type WorkerFunction<Data = unknown, Response = unknown> =
  | WorkerSyncFunction<Data, Response>
  | WorkerAsyncFunction<Data, Response>
/**
 * Worker functions that can be executed object.
 * This object can contain synchronous or asynchronous functions.
 * The key is the name of the function.
 * The value is the function itself.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export type TaskFunctions<Data = unknown, Response = unknown> = Record<
string,
WorkerFunction<Data, Response>
>

/**
 * An object holding the execution response promise resolve/reject callbacks.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 * @internal
 */
export interface PromiseResponseWrapper<
  Worker extends IWorker,
  Response = unknown
> {
  /**
   * Resolve callback to fulfill the promise.
   */
  readonly resolve: (value: Response) => void
  /**
   * Reject callback to reject the promise.
   */
  readonly reject: (reason?: string) => void
  /**
   * The worker handling the execution.
   */
  readonly worker: Worker
}
