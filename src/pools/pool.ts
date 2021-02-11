import type { PoolEmitter } from './abstract-pool'

export type ErrorHandler<Worker> = (this: Worker, e: Error) => void
export type OnlineHandler<Worker> = (this: Worker) => void
export type ExitHandler<Worker> = (this: Worker, code: number) => void

export interface IWorker {
  on(event: 'error', handler: ErrorHandler<this>): void
  on(event: 'online', handler: OnlineHandler<this>): void
  on(event: 'exit', handler: ExitHandler<this>): void
}

export interface IPool<
  Worker extends IWorker,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Response = any
> {
  readonly workers: Worker[]
  // nextWorker: number // Do we want to define this here?
  readonly tasks: Map<Worker, number>
  readonly emitter: PoolEmitter
  destroy(): Promise<void>
  execute(data: Data): Promise<Response>
}
