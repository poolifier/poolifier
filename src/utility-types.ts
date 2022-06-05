import type { Worker as ClusterWorker } from 'cluster'
import type { MessagePort } from 'worker_threads'
import type { AbstractPoolWorker } from './pools/abstract-pool-worker'
import type { KillBehavior } from './worker/worker-options'

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
  readonly id?: number
  /**
   * Id of the worker sending the message.
   */
  readonly workerId?: number
  /**
   * Kill code.
   */
  readonly kill?: KillBehavior | 1
  /**
   * Error.
   */
  readonly error?: string
  /**
   * Number of workers in the pool.
   */
  readonly numberOfWorkers?: number
  /**
   * Shared array buffer for workers tasks usage statistics.
   */
  readonly tasksSharedUsage?: SharedArrayBuffer
  /**
   * Task run time.
   */
  readonly taskRunTime?: number
  /**
   * Reference to main worker.
   *
   * Only for internal use.
   */
  readonly parent?: MainWorker
}

/**
 * An object holding the worker that will be used to resolve/rejects the promise later on.
 *
 * @template Worker Type of worker.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export interface PromiseWorkerResponseWrapper<
  Worker extends AbstractPoolWorker,
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
   * The worker that has the assigned task.
   */
  readonly worker: Worker
}
