import type { MessageValue } from '../utility-types.js'
import type { WorkerHandle } from './lifecycle-types.js'

import { WorkerTerminationError } from './errors.js'

export interface TaskFunctionTransport<Worker, Data, Response> {
  readonly admit: (handle: WorkerHandle<Worker>) => boolean
  readonly deregister: (
    handle: WorkerHandle<Worker>,
    listener: TaskFunctionOperationListener<Response>
  ) => void
  readonly isCurrent: (handle: WorkerHandle<Worker>) => boolean
  readonly register: (
    handle: WorkerHandle<Worker>,
    listener: TaskFunctionOperationListener<Response>
  ) => void
  readonly send: (
    handle: WorkerHandle<Worker>,
    message: MessageValue<Data>
  ) => void
  readonly snapshot: () => readonly WorkerHandle<Worker>[]
}

interface BroadcastRequest<Response> {
  readonly listener: TaskFunctionOperationListener<Response>
  readonly reject: (error: Error) => void
}

type TaskFunctionOperationListener<Response> = (
  message: MessageValue<Response>
) => void

export class TaskFunctionBroadcaster<
  Worker,
  Data = unknown,
  Response = unknown
> {
  readonly #requestsByHandle = new Map<
    WorkerHandle<Worker>,
    Set<BroadcastRequest<Response>>
  >()

  public constructor (
    private readonly transport: TaskFunctionTransport<Worker, Data, Response>
  ) {}

  public reject (handle: WorkerHandle<Worker>, error: Error): void {
    const requests = this.#requestsByHandle.get(handle)
    if (requests == null) return
    for (const request of [...requests]) request.reject(error)
  }

  public async sendToWorker (
    handle: undefined | WorkerHandle<Worker>,
    message: MessageValue<Data>,
    signal?: AbortSignal
  ): Promise<boolean> {
    if (handle == null) return false
    return await this.#send(handle, message, signal)
  }

  public async sendToWorkers (
    message: MessageValue<Data>,
    signal?: AbortSignal
  ): Promise<boolean> {
    const handles = this.transport.snapshot()
    const results = await Promise.all(
      handles.map(async handle => await this.#send(handle, message, signal))
    )
    return results.every(Boolean)
  }

  async #send (
    handle: WorkerHandle<Worker>,
    message: MessageValue<Data>,
    signal?: AbortSignal
  ): Promise<boolean> {
    if (signal?.aborted !== true && !this.transport.admit(handle)) {
      throw new WorkerTerminationError('Worker node terminated by pool', {
        workerId: handle.lease.id,
      })
    }
    let settled = false
    let request: BroadcastRequest<Response>
    const cleanup = (): Error | undefined => {
      const requests = this.#requestsByHandle.get(handle)
      requests?.delete(request)
      if (requests?.size === 0) this.#requestsByHandle.delete(handle)
      let cleanupError: Error | undefined
      try {
        signal?.removeEventListener('abort', abort)
      } catch (error) {
        cleanupError = error instanceof Error ? error : new Error(String(error))
      }
      try {
        this.transport.deregister(handle, request.listener)
      } catch (error) {
        cleanupError ??=
          error instanceof Error ? error : new Error(String(error))
      }
      return cleanupError
    }
    const abort = (): void => {
      request.reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted', 'AbortError')
      )
    }
    return await new Promise<boolean>((resolve, reject) => {
      const settle = (result: boolean | Error): void => {
        if (settled) return
        settled = true
        const cleanupError = cleanup()
        if (result instanceof Error) {
          reject(result)
        } else if (cleanupError != null) {
          reject(cleanupError)
        } else {
          resolve(result)
        }
      }
      const listener: TaskFunctionOperationListener<Response> = response => {
        if (
          !this.transport.isCurrent(handle) ||
          response.taskFunctionOperationStatus == null ||
          response.workerId !== handle.lease.id ||
          response.taskFunctionOperation !== message.taskFunctionOperation ||
          response.taskFunctionProperties?.name !==
            message.taskFunctionProperties?.name ||
          response.taskFunctionOperationId !== message.taskFunctionOperationId
        ) {
          return
        }
        settle(response.taskFunctionOperationStatus)
      }
      request = { listener, reject: settle }
      try {
        if (signal?.aborted === true) {
          abort()
          return
        }
        const requests = this.#requestsByHandle.get(handle) ?? new Set()
        requests.add(request)
        this.#requestsByHandle.set(handle, requests)
        this.transport.register(handle, listener)
        signal?.addEventListener('abort', abort, { once: true })
        this.transport.send(handle, message)
      } catch (error) {
        settle(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}
