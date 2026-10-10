import { type EventEmitter, EventEmitterAsyncResource } from 'node:events'

import type { WorkerLease } from './lifecycle-types.js'
import type { PoolEvent } from './pool.js'

export type LifecycleCollector = 'pool-destroy' | WorkerLease

export class PoolEventPublisher {
  public readonly emitter?: EventEmitterAsyncResource

  readonly #deferredErrors = new Map<LifecycleCollector, unknown[]>()

  public constructor (name: string, enabled: boolean) {
    if (enabled) {
      this.emitter = new EventEmitterAsyncResource({ name })
    }
  }

  public collect (owner: LifecycleCollector, error: unknown): void {
    const errors = this.#deferredErrors.get(owner)
    if (errors == null) {
      this.#deferredErrors.set(owner, [error])
    } else {
      errors.push(error)
    }
  }

  public defer (error: unknown, owner?: LifecycleCollector): void {
    if (owner == null) {
      queueMicrotask(() => {
        throw error
      })
    } else {
      this.collect(owner, error)
    }
  }

  public deferAll (
    errors: readonly unknown[],
    owner?: LifecycleCollector
  ): void {
    for (const error of errors) {
      this.defer(error, owner)
    }
  }

  public drain (owner: LifecycleCollector): void {
    const errors = this.#deferredErrors.get(owner)
    if (errors == null) {
      return
    }
    this.#deferredErrors.delete(owner)
    for (const error of errors) {
      this.defer(error)
    }
  }

  public drainAll (): void {
    for (const owner of [...this.#deferredErrors.keys()]) {
      this.drain(owner)
    }
  }

  public invoke<Receiver, Arguments extends readonly unknown[]>(
    callback: (this: Receiver, ...args: Arguments) => void,
    receiver: Receiver,
    args: Arguments,
    owner?: LifecycleCollector
  ): void {
    try {
      callback.call(receiver, ...args)
    } catch (error) {
      // no-excuse-ok: catch -- configured callbacks may throw arbitrary values
      this.defer(error, owner)
    }
  }

  public publish (
    eventName: PoolEvent,
    payload: unknown,
    owner?: LifecycleCollector
  ): void {
    if (this.emitter == null || this.emitter.listenerCount(eventName) === 0) {
      return
    }
    try {
      this.emitter.emit(eventName, payload)
    } catch (error) {
      // no-excuse-ok: catch -- event listeners may throw arbitrary values
      this.defer(error, owner)
    }
  }

  public publishInternal (
    emitter: EventEmitter,
    eventName: string,
    payload: unknown,
    owner?: LifecycleCollector
  ): void {
    try {
      emitter.emit(eventName, payload)
    } catch (error) {
      // no-excuse-ok: catch -- internal listeners may throw arbitrary values
      this.defer(error, owner)
    }
  }

  public transfer (from: WorkerLease, to: LifecycleCollector): void {
    const errors = this.#deferredErrors.get(from)
    if (errors == null) {
      return
    }
    this.#deferredErrors.delete(from)
    const destinationErrors = this.#deferredErrors.get(to)
    if (destinationErrors == null) {
      this.#deferredErrors.set(to, errors)
    } else {
      destinationErrors.push(...errors)
    }
  }
}
