export type Draft<T> = { -readonly [P in keyof T]?: T[P] }

export type JSONPrimitive = number | boolean | string | null
// eslint-disable-next-line no-use-before-define
export type JSONValue = JSONPrimitive | JSONArray | JSONObject
export type JSONObject = { [k: string]: JSONValue }
export type JSONArray = Array<JSONValue>

export interface MessageValue<Data = unknown> {
  readonly data?: Data
  readonly id?: number
  readonly kill?: number
  readonly error?: string
  readonly parent?: MessagePort
}
