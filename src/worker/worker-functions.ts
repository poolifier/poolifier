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
 * Worker functions that can be executed.
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
