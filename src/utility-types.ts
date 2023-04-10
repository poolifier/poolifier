import type { Worker as ClusterWorker } from 'node:cluster'
import type { MessagePort } from 'node:worker_threads'
import type { KillBehavior } from './worker/worker-options'
import type { IWorker } from './pools/worker'

/**
 * Make all properties in T non-readonly.
 */
export type Draft<T> = { -readonly [P in keyof T]?: T[P] }

/**
 * Message object that is passed between worker and main worker.
 */
export interface MessageValue<
  Data = unknown,
  MainWorker extends ClusterWorker | MessagePort | unknown = unknown
> {
  /**
   * Input data that will be passed to the worker.
   */
  readonly data?: Data
  /**
   * Id of the message.
   */
  readonly id?: string
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
   *
   * Only for internal use.
   * @internal
   */
  readonly parent?: MainWorker
}

/**
 * An object holding the execution response promise resolve/reject callbacks.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Response - Type of execution response. This can only be serializable data.
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
