import type { Worker } from 'cluster'
import type { MessagePort } from 'worker_threads'

/**
 * Make all properties in T non-readonly
 */
export type Draft<T> = { -readonly [P in keyof T]?: T[P] }

/**
 * Serializable primitive JSON value.
 */
export type JSONPrimitive = number | boolean | string | null
/**
 * Serializable JSON value.
 */
// eslint-disable-next-line no-use-before-define
export type JSONValue = JSONPrimitive | JSONArray | JSONObject
/**
 * Serializable JSON object.
 */
export type JSONObject = { [k: string]: JSONValue }
/**
 * Serializable JSON array.
 */
export type JSONArray = Array<JSONValue>

/**
 * Message object that is passed between worker and main worker.
 */
export interface MessageValue<
  Data = unknown,
  MainWorker extends Worker | MessagePort | unknown = unknown
> {
  /**
   * Input data that will be passed to the worker.
   */
  readonly data?: Data
  /**
   * ID of the message.
   */
  readonly id?: number
  /**
   * Kill code.
   */
  readonly kill?: number
  /**
   * Error.
   */
  readonly error?: string
  /**
   * Reference to main worker.
   *
   * _Only for internal use_
   */
  readonly parent?: MainWorker
}
