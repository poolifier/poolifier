export interface IPool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Response = any
> {
  destroy(): Promise<void>
  execute(data: Data): Promise<Response>
}
