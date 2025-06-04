import type { AsyncResource } from 'node:async_hooks'
import type { EventLoopUtilization } from 'node:perf_hooks'
import type { MessagePort, Transferable } from 'node:worker_threads'

import type { WorkerChoiceStrategy } from './pools/selection-strategies/selection-strategies-types.js'
import type { KillBehavior } from './worker/worker-options.js'

/**
 * Message object that is passed between main worker and worker.
 * @typeParam Data - Type of data sent to the worker or execution response. This can only be structured-cloneable data.
 * @typeParam ErrorData - Type of data sent to the worker triggering an error. This can only be structured-cloneable data.
 * @internal
 */
export interface MessageValue<Data = unknown, ErrorData = unknown>
  extends Task<Data> {
  /**
   * Whether the worker starts or stops its activity check.
   */
  readonly checkActive?: boolean
  /**
   * Kill code.
   */
  readonly kill?: 'failure' | 'success' | KillBehavior | true
  /**
   * Message port.
   */
  readonly port?: MessagePort
  /**
   * Whether the worker is ready or not.
   */
  readonly ready?: boolean
  /**
   * Whether the worker computes the given statistics or not.
   */
  readonly statistics?: WorkerStatistics
  /**
   * Task function serialized to string.
   */
  readonly taskFunction?: string
  /**
   * Task function operation:
   * - `'add'` - Add a task function.
   * - `'remove'` - Remove a task function.
   * - `'default'` - Set a task function as default.
   */
  readonly taskFunctionOperation?: 'add' | 'default' | 'remove'
  /**
   * Whether the task function operation is successful or not.
   */
  readonly taskFunctionOperationStatus?: boolean
  /**
   * Task function properties.
   */
  readonly taskFunctionProperties?: TaskFunctionProperties
  /**
   * Task functions properties.
   */
  readonly taskFunctionsProperties?: TaskFunctionProperties[]
  /**
   * Task performance.
   */
  readonly taskPerformance?: TaskPerformance
  /**
   * Worker error.
   */
  readonly workerError?: WorkerError<ErrorData>
  /**
   * Worker id.
   */
  readonly workerId?: number
}

/**
 * An object holding the task execution response promise resolve/reject callbacks.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 * @internal
 */
export interface PromiseResponseWrapper<Response = unknown> {
  /**
   * The asynchronous resource used to track the task execution.
   */
  readonly asyncResource?: AsyncResource
  /**
   * Reject callback to reject the promise.
   */
  readonly reject: (reason?: unknown) => void
  /**
   * Resolve callback to fulfill the promise.
   */
  readonly resolve: (value: PromiseLike<Response> | Response) => void
  /**
   * The worker node key executing the task.
   */
  readonly workerNodeKey: number
}

/**
 * Message object that is passed as a task between main worker and worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @internal
 */
export interface Task<Data = unknown> {
  /**
   * Task input data that will be passed to the worker.
   */
  readonly data?: Data
  /**
   * Task name.
   */
  readonly name?: string
  /**
   * Task priority. Lower values have higher priority.
   * @defaultValue 0
   */
  readonly priority?: number
  /**
   * Task worker choice strategy.
   */
  readonly strategy?: WorkerChoiceStrategy
  /**
   * Task UUID.
   */
  readonly taskId?: `${string}-${string}-${string}-${string}-${string}`
  /**
   * Timestamp.
   */
  readonly timestamp?: number
  /**
   * Array of transferable objects.
   */
  readonly transferList?: readonly Transferable[]
}

/**
 * Task function properties.
 */
export interface TaskFunctionProperties {
  /**
   * Task function name.
   */
  readonly name: string
  /**
   * Task function priority. Lower values have higher priority.
   */
  readonly priority?: number
  /**
   * Task function worker choice strategy.
   */
  readonly strategy?: WorkerChoiceStrategy
  /**
   * Task function worker node keys affinity.
   */
  readonly workerNodes?: number[]
}

/**
 * Task performance.
 * @internal
 */
export interface TaskPerformance {
  /**
   * Task event loop utilization.
   */
  readonly elu?: EventLoopUtilization
  /**
   * Task name.
   */
  readonly name: string
  /**
   * Task runtime.
   */
  readonly runTime?: number
  /**
   * Task performance timestamp.
   */
  readonly timestamp: number
}

/**
 * Worker error.
 * @typeParam Data - Type of data sent to the worker triggering an error. This can only be structured-cloneable data.
 */
export interface WorkerError<Data = unknown> {
  /**
   * Data triggering the error.
   */
  readonly data?: Data
  /**
   * Error object.
   */
  readonly error?: Error
  /**
   * Error message.
   */
  readonly message: string
  /**
   * Task function name triggering the error.
   */
  readonly name?: string
  /**
   * Error stack trace.
   */
  readonly stack?: string
}

/**
 * Worker task performance statistics computation settings.
 * @internal
 */
export interface WorkerStatistics {
  /**
   * Whether the worker computes the task event loop utilization (ELU) or not.
   */
  readonly elu: boolean
  /**
   * Whether the worker computes the task runtime or not.
   */
  readonly runTime: boolean
}

/**
 * Remove readonly modifier from all properties of T.
 * @typeParam T - Type to remove readonly modifier.
 * @internal
 */
export type Writable<T> = { -readonly [P in keyof T]: T[P] }
