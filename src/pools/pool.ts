export interface IPool<Data = unknown, Response = unknown> {
  destroy(): Promise<void>
  execute(data: Data): Promise<Response>
}
