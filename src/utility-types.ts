import type { EventLoopUtilization } from 'node:perf_hooks'
import type { MessagePort, TransferListItem } from 'node:worker_threads'
import type { KillBehavior } from './worker/worker-options'

/**
 * Worker error.
 *
 * @typeParam Data - Type of data sent to the worker triggering an error. This can only be structured-cloneable data.
 */
export interface WorkerError<Data = unknown> {
  /**
   * Task function name triggering the error.
   */
  readonly name: string
  /**
   * Error message.
   */
  readonly message: string
  /**
   * Data triggering the error.
   */
  readonly data?: Data
}

/**
 * Task performance.
 *
 * @internal
 */
export interface TaskPerformance {
  /**
   * Task name.
   */
  readonly name: string
  /**
   * Task performance timestamp.
   */
  readonly timestamp: number
  /**
   * Task runtime.
   */
  readonly runTime?: number
  /**
   * Task event loop utilization.
   */
  readonly elu?: EventLoopUtilization
}

/**
 * Worker task performance statistics computation settings.
 *
 * @internal
 */
export interface WorkerStatistics {
  /**
   * Whether the worker computes the task runtime or not.
   */
  readonly runTime: boolean
  /**
   * Whether the worker computes the task event loop utilization (ELU) or not.
   */
  readonly elu: boolean
}

/**
 * Message object that is passed as a task between main worker and worker.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @internal
 */
export interface Task<Data = unknown> {
  /**
   * Task name.
   */
  readonly name?: string
  /**
   * Task input data that will be passed to the worker.
   */
  readonly data?: Data
  /**
   * Array of transferable objects.
   */
  readonly transferList?: TransferListItem[]
  /**
   * Timestamp.
   */
  readonly timestamp?: number
  /**
   * Abort signal.
   */
  readonly abortSignal?: AbortSignal
  /**
   * Task UUID.
   */
  readonly taskId?: string
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
   * Worker id.
   */
  readonly workerId?: number
  /**
   * Kill code.
   */
  readonly kill?: KillBehavior | true | 'success' | 'failure'
  /**
   * Worker error.
   */
  readonly workerError?: WorkerError<ErrorData>
  /**
   * Task performance.
   */
  readonly taskPerformance?: TaskPerformance
  /**
   * Task function operation:
   * - `'add'` - Add a task function.
   * - `'remove'` - Remove a task function.
   * - `'default'` - Set a task function as default.
   */
  readonly taskFunctionOperation?: 'add' | 'remove' | 'default'
  /**
   * Whether the task function operation is successful or not.
   */
  readonly taskFunctionOperationStatus?: boolean
  /**
   * Task function serialized to string.
   */
  readonly taskFunction?: string
  /**
   * Task function name.
   */
  readonly taskFunctionName?: string
  /**
   * Task function names.
   */
  readonly taskFunctionNames?: string[]
  /**
   * Whether the worker computes the given statistics or not.
   */
  readonly statistics?: WorkerStatistics
  /**
   * Whether the worker is ready or not.
   */
  readonly ready?: boolean
  /**
   * Whether the worker starts or stops its activity check.
   */
  readonly checkActive?: boolean
  /**
   * Message port.
   */
  readonly port?: MessagePort
}

/**
 * An object holding the task execution response promise resolve/reject callbacks.
 *
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 * @internal
 */
export interface PromiseResponseWrapper<Response = unknown> {
  /**
   * Resolve callback to fulfill the promise.
   */
  readonly resolve: (value: Response | PromiseLike<Response>) => void
  /**
   * Reject callback to reject the promise.
   */
  readonly reject: (reason?: unknown) => void
  /**
   * The worker node key executing the task.
   */
  readonly workerNodeKey: number
}

export type Writable<T> = { -readonly [P in keyof T]: T[P] }
