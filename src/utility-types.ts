import type { EventLoopUtilization } from 'node:perf_hooks'
import type { KillBehavior } from './worker/worker-options'
import type { IWorker, Task } from './pools/worker'

/**
 * Task error.
 *
 * @typeParam Data - Type of data sent to the worker triggering an error. This can only be structured-cloneable data.
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
   * Task event loop utilization.
   */
  elu?: EventLoopUtilization
}

/**
 * Performance statistics computation.
 */
export interface WorkerStatistics {
  runTime: boolean
  elu: boolean
}

/**
 * Message object that is passed between main worker and worker.
 *
 * @typeParam Data - Type of data sent to the worker or execution response. This can only be structured-cloneable data.
 * @typeParam ErrorData - Type of data sent to the worker triggering an error. This can only be structured-cloneable data.
 * @internal
 */
export interface MessageValue<Data = unknown, ErrorData = unknown>
  extends Task<Data> {
  /**
   * Worker Id.
   */
  readonly workerId?: number
  /**
   * Kill code.
   */
  readonly kill?: KillBehavior | 1
  /**
   * Task error.
   */
  readonly taskError?: TaskError<ErrorData>
  /**
   * Task performance.
   */
  readonly taskPerformance?: TaskPerformance
  /**
   * Whether the worker computes the given statistics or not.
   */
  readonly statistics?: WorkerStatistics
  /**
   * Whether the worker has started or not.
   */
  readonly started?: boolean
}

/**
 * An object holding the execution response promise resolve/reject callbacks.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
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
