import type { WorkerChoiceStrategy } from '../pools/selection-strategies/selection-strategies-types.js'

/**
 * Task synchronous function that can be executed.
 * @param data - Data sent to the worker.
 * @returns Execution response.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export type TaskSyncFunction<Data = unknown, Response = unknown> = (
  data?: Data
) => Response

/**
 * Task asynchronous function that can be executed.
 * This function must return a promise.
 * @param data - Data sent to the worker.
 * @returns Execution response promise.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export type TaskAsyncFunction<Data = unknown, Response = unknown> = (
  data?: Data
) => Promise<Response>

/**
 * Task function that can be executed.
 * This function can be synchronous or asynchronous.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export type TaskFunction<Data = unknown, Response = unknown> =
  | TaskSyncFunction<Data, Response>
  | TaskAsyncFunction<Data, Response>

/**
 * Task function object.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export interface TaskFunctionObject<Data = unknown, Response = unknown> {
  /**
   * Task function.
   */
  taskFunction: TaskFunction<Data, Response>
  /**
   * Task function priority. Lower values have higher priority.
   */
  priority?: number
  /**
   * Task function worker choice strategy.
   */
  strategy?: WorkerChoiceStrategy
}

/**
 * Tasks functions that can be executed.
 * The key is the name of the task function or task function object.
 * The value is the task function or task function object.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export type TaskFunctions<Data = unknown, Response = unknown> = Record<
  string,
  TaskFunction<Data, Response> | TaskFunctionObject<Data, Response>
>

/**
 * Task function operation result.
 */
export interface TaskFunctionOperationResult {
  status: boolean
  error?: Error
}
