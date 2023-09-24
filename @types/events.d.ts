import type { AsyncResource, AsyncResourceOptions } from 'node:async_hooks'
import { EventEmitter } from 'node:events'

declare module 'node:events' {
  interface EventEmitterOptions {
    /**
     * Enables automatic capturing of promise rejection.
     */
    captureRejections?: boolean | undefined
  }

  interface EventEmitterAsyncResourceOptions
    extends AsyncResourceOptions,
    EventEmitterOptions {
    /**
     * The type of async event.
     * @default new.target.name
     */
    name?: string
  }

  /**
   * Integrates `EventEmitter` with `AsyncResource` for `EventEmitters` that require
   * manual async tracking. Specifically, all events emitted by instances of
   * `EventEmitterAsyncResource` will run within its async context.
   *
   * The EventEmitterAsyncResource class has the same methods and takes the
   * same options as EventEmitter and AsyncResource themselves.
   */
  export class EventEmitterAsyncResource extends EventEmitter {
    constructor (options?: EventEmitterAsyncResourceOptions)
    /**
     * Call all `destroy` hooks. This should only ever be called once. An error will
     * be thrown if it is called more than once. This **must** be manually called. If
     * the resource is left to be collected by the GC then the `destroy` hooks will
     * never be called.
     * @return A reference to `asyncResource`.
     */
    emitDestroy (): AsyncResource
    /** The unique asyncId assigned to the resource. */
    get asyncId (): number
    /** The same triggerAsyncId that is passed to the AsyncResource constructor. */
    get triggerAsyncId (): number
    /** The underlying AsyncResource */
    get asyncResource (): AsyncResource & {
      readonly eventEmitter: EventEmitterAsyncResource
    }
  }
}
