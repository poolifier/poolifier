import type { Worker as ClusterWorker } from 'node:cluster'
import type { MessagePort } from 'node:worker_threads'
import type { EventLoopUtilization } from 'node:perf_hooks'
import type { KillBehavior } from './worker/worker-options'
import type { IWorker, Task } from './pools/worker'

/**
 * Make all properties in T non-readonly.
 *
 * @typeParam T - Type in which properties will be non-readonly.
 */
export type Draft<T> = { -readonly [P in keyof T]?: T[P] }

/**
 * Task error.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 */
export interface TaskError<Data = unknown> {
  /**
   * Error message.
   */
  message: string
  /**
   * Data passed to the worker triggering the error.
   */
  data?: Data
}

/**
 * Task performance.
 */
export interface TaskPerformance {
  /**
   * Task performance timestamp.
   */
  timestamp: number
  /**
   * Task runtime.
   */
  runTime?: number
  /**
   * Task wait time.
   */
  waitTime?: number
  /**
   * Task event loop utilization.
   */
  elu?: EventLoopUtilization
}

/**
 * Performance statistics computation.
 */
export interface WorkerStatistics {
  runTime: boolean
  waitTime: boolean
  elu: boolean
}

/**
 * Message object that is passed between main worker and worker.
 *
 * @typeParam MessageData - Type of data sent to and/or from the worker. This can only be serializable data.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam MainWorker - Type of main worker.
 * @internal
 */
export interface MessageValue<
  MessageData = unknown,
  Data = unknown,
  MainWorker extends ClusterWorker | MessagePort = ClusterWorker | MessagePort
> extends Task<MessageData> {
  /**
   * Kill code.
   */
  readonly kill?: KillBehavior | 1
  /**
   * Task error.
   */
  readonly taskError?: TaskError<Data>
  /**
   * Task performance.
   */
  readonly taskPerformance?: TaskPerformance
  /**
   * Reference to main worker.
   */
  readonly parent?: MainWorker
  /**
   * Whether to compute the given statistics or not.
   */
  readonly statistics?: WorkerStatistics
}

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
