import type { JSONValue } from '../utility-types'

export interface IPool<
  Data extends JSONValue = JSONValue,
  Response extends JSONValue = JSONValue
> {
  destroy(): Promise<void>
  execute(data: Data): Promise<Response>
}
