import { AsyncResource } from 'node:async_hooks'
import type { Worker } from 'node:cluster'
import type { MessagePort } from 'node:worker_threads'
import type { MessageValue } from '../utility-types'
import { EMPTY_FUNCTION } from '../utils'
import type { KillBehavior, WorkerOptions } from './worker-options'
import { KillBehaviors } from './worker-options'

const DEFAULT_MAX_INACTIVE_TIME = 60000
const DEFAULT_KILL_BEHAVIOR: KillBehavior = KillBehaviors.SOFT

/**
 * Base class that implements some shared logic for all poolifier workers.
 *
 * @typeParam MainWorker - Type of main worker.
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be serializable data.
 * @typeParam Response - Type of response the worker sends back to the main worker. This can only be serializable data.
 */
export abstract class AbstractWorker<
  MainWorker extends Worker | MessagePort,
  Data = unknown,
  Response = unknown
> extends AsyncResource {
  /**
   * Timestamp of the last task processed by this worker.
   */
  protected lastTaskTimestamp!: number
  /**
   * Handler id of the `aliveInterval` worker alive check.
   */
  protected readonly aliveInterval?: NodeJS.Timeout
  /**
   * Constructs a new poolifier worker.
   *
   * @param type - The type of async event.
   * @param isMain - Whether this is the main worker or not.
   * @param fn - Function processed by the worker when the pool's `execution` function is invoked.
   * @param mainWorker - Reference to main worker.
   * @param opts - Options for the worker.
   */
  public constructor (
    type: string,
    protected readonly isMain: boolean,
    fn: (data: Data) => Response,
    protected mainWorker: MainWorker | undefined | null,
    protected readonly opts: WorkerOptions = {
      /**
       * The kill behavior option on this worker or its default value.
       */
      killBehavior: DEFAULT_KILL_BEHAVIOR,
      /**
       * The maximum time to keep this worker alive while idle.
       * The pool automatically checks and terminates this worker when the time expires.
       */
      maxInactiveTime: DEFAULT_MAX_INACTIVE_TIME
    }
  ) {
    super(type)
    this.checkFunctionInput(fn)
    this.checkWorkerOptions(this.opts)
    if (!this.isMain) {
      this.lastTaskTimestamp = performance.now()
      this.aliveInterval = setInterval(
        this.checkAlive.bind(this),
        (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME) / 2
      )
      this.checkAlive.bind(this)()
    }

    this.mainWorker?.on(
      'message',
      (message: MessageValue<Data, MainWorker>) => {
        this.messageListener(message, fn)
      }
    )
  }

  /**
   * Worker message listener.
   *
   * @param message - Message received.
   * @param fn - Function processed by the worker when the pool's `execution` function is invoked.
   */
  protected messageListener (
    message: MessageValue<Data, MainWorker>,
    fn: (data: Data) => Response
  ): void {
    if (message.data != null && message.id != null) {
      // Task message received
      if (this.opts.async === true) {
        this.runInAsyncScope(this.runAsync.bind(this), this, fn, message)
      } else {
        this.runInAsyncScope(this.run.bind(this), this, fn, message)
      }
    } else if (message.parent != null) {
      // Main worker reference message received
      this.mainWorker = message.parent
    } else if (message.kill != null) {
      // Kill message received
      this.aliveInterval != null && clearInterval(this.aliveInterval)
      this.emitDestroy()
    }
  }

  private checkWorkerOptions (opts: WorkerOptions): void {
    this.opts.killBehavior = opts.killBehavior ?? DEFAULT_KILL_BEHAVIOR
    this.opts.maxInactiveTime =
      opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME
    this.opts.async = opts.async ?? false
  }

  /**
   * Checks if the `fn` parameter is passed to the constructor.
   *
   * @param fn - The function that should be defined.
   */
  private checkFunctionInput (fn: (data: Data) => Response): void {
    if (fn == null) throw new Error('fn parameter is mandatory')
    if (typeof fn !== 'function') {
      throw new TypeError('fn parameter is not a function')
    }
  }

  /**
   * Returns the main worker.
   *
   * @returns Reference to the main worker.
   */
  protected getMainWorker (): MainWorker {
    if (this.mainWorker == null) {
      throw new Error('Main worker was not set')
    }
    return this.mainWorker
  }

  /**
   * Sends a message to the main worker.
   *
   * @param message - The response message.
   */
  protected abstract sendToMainWorker (message: MessageValue<Response>): void

  /**
   * Checks if the worker should be terminated, because its living too long.
   */
  protected checkAlive (): void {
    if (
      performance.now() - this.lastTaskTimestamp >
      (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME)
    ) {
      this.sendToMainWorker({ kill: this.opts.killBehavior })
    }
  }

  /**
   * Handles an error and convert it to a string so it can be sent back to the main worker.
   *
   * @param e - The error raised by the worker.
   * @returns Message of the error.
   */
  protected handleError (e: Error | string): string {
    return e as string
  }

  /**
   * Runs the given function synchronously.
   *
   * @param fn - Function that will be executed.
   * @param message - Input data for the given function.
   */
  protected run (
    fn: (data?: Data) => Response,
    message: MessageValue<Data>
  ): void {
    try {
      const startTimestamp = performance.now()
      const res = fn(message.data)
      const runTime = performance.now() - startTimestamp
      this.sendToMainWorker({
        data: res,
        id: message.id,
        runTime
      })
    } catch (e) {
      const err = this.handleError(e as Error)
      this.sendToMainWorker({ error: err, id: message.id })
    } finally {
      !this.isMain && (this.lastTaskTimestamp = performance.now())
    }
  }

  /**
   * Runs the given function asynchronously.
   *
   * @param fn - Function that will be executed.
   * @param message - Input data for the given function.
   */
  protected runAsync (
    fn: (data?: Data) => Promise<Response>,
    message: MessageValue<Data>
  ): void {
    const startTimestamp = performance.now()
    fn(message.data)
      .then(res => {
        const runTime = performance.now() - startTimestamp
        this.sendToMainWorker({
          data: res,
          id: message.id,
          runTime
        })
        return null
      })
      .catch(e => {
        const err = this.handleError(e as Error)
        this.sendToMainWorker({ error: err, id: message.id })
      })
      .finally(() => {
        !this.isMain && (this.lastTaskTimestamp = performance.now())
      })
      .catch(EMPTY_FUNCTION)
  }
}
