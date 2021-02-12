/**
 * Make all properties in T non-readonly
 */
export type Draft<T> = { -readonly [P in keyof T]?: T[P] }

export type JSONPrimitive = number | boolean | string | null
// eslint-disable-next-line no-use-before-define
export type JSONValue = JSONPrimitive | JSONArray | JSONObject
export type JSONObject = { [k: string]: JSONValue }
export type JSONArray = Array<JSONValue>

/**
 * Message object that is passed between worker and main worker.
 */
export interface MessageValue<Data = unknown> {
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
  readonly parent?: MessagePort
}
