import { AsyncResource } from 'async_hooks'
import type { Worker } from 'cluster'
import type { MessagePort } from 'worker_threads'
import type { MessageValue, KillBehavior } from '../utility-types'
import type { WorkerOptions } from './worker-options'

const defaultMaxInactiveTime = 1000 * 60
// TODO fix this and avoid that SOFT/HARD words are replicated so much times into the project
const defaultKillBehavior: KillBehavior = 'SOFT'

/**
 * Base class containing some shared logic for all poolifier workers.
 *
 * @template MainWorker Type of main worker.
 * @template Data Type of data this worker receives from pool's execution.
 * @template Response Type of response the worker sends back to the main worker.
 */
export abstract class AbstractWorker<
  MainWorker extends Worker | MessagePort,
  Data = unknown,
  Response = unknown
> extends AsyncResource {
  /**
   * The maximum time to keep this worker alive while idle. The pool automatically checks and terminates this worker when the time expires.
   */
  protected readonly maxInactiveTime: number
  /**
   * The kill behavior set as option on the Worker constructor or a default value.
   */
  protected readonly killBehavior: KillBehavior
  /**
   * Whether the worker is working asynchronously or not.
   */
  protected readonly async: boolean
  /**
   * Timestamp of the last task processed by this worker.
   */
  protected lastTask: number
  /**
   * Handler ID of the `interval` alive check.
   */
  protected readonly interval?: NodeJS.Timeout

  /**
   * Constructs a new poolifier worker.
   *
   * @param type The type of async event.
   * @param isMain Whether this is the main worker or not.
   * @param fn Function processed by the worker when the pool's `execution` function is invoked.
   * @param mainWorker Reference to main worker.
   * @param opts Options for the worker.
   */
  public constructor (
    type: string,
    isMain: boolean,
    fn: (data: Data) => Response,
    protected mainWorker?: MainWorker | null,
    public readonly opts: WorkerOptions = {
      killBehavior: defaultKillBehavior,
      maxInactiveTime: defaultMaxInactiveTime
    }
  ) {
    super(type)
    this.killBehavior = this.opts.killBehavior ?? defaultKillBehavior
    this.maxInactiveTime = this.opts.maxInactiveTime ?? defaultMaxInactiveTime
    this.async = !!this.opts.async
    this.lastTask = Date.now()
    if (!fn) throw new Error('fn parameter is mandatory')
    // Keep the worker active
    if (!isMain) {
      this.interval = setInterval(
        this.checkAlive.bind(this),
        this.maxInactiveTime / 2
      )
      this.checkAlive.bind(this)()
    }

    this.mainWorker?.on('message', (value: MessageValue<Data, MainWorker>) => {
      if (value?.data && value.id) {
        // Here you will receive messages
        if (this.async) {
          this.runInAsyncScope(this.runAsync.bind(this), this, fn, value)
        } else {
          this.runInAsyncScope(this.run.bind(this), this, fn, value)
        }
      } else if (value.parent) {
        // Save a reference of the main worker to communicate with it
        // This will be received once
        this.mainWorker = value.parent
      } else if (value.kill) {
        // Here is time to kill this worker, just clearing the interval
        if (this.interval) clearInterval(this.interval)
        this.emitDestroy()
      }
    })
  }

  /**
   * Returns the main worker.
   *
   * @returns Reference to the main worker.
   */
  protected getMainWorker (): MainWorker {
    if (!this.mainWorker) {
      throw new Error('Main worker was not set')
    }
    return this.mainWorker
  }

  /**
   * Send a message to the main worker.
   *
   * @param message The response message.
   */
  protected abstract sendToMainWorker (message: MessageValue<Response>): void

  /**
   * Check to see if the worker should be terminated, because its living too long.
   */
  protected checkAlive (): void {
    if (Date.now() - this.lastTask > this.maxInactiveTime) {
      this.sendToMainWorker({ kill: this.killBehavior })
    }
  }

  /**
   * Handle an error and convert it to a string so it can be sent back to the main worker.
   *
   * @param e The error raised by the worker.
   * @returns Message of the error.
   */
  protected handleError (e: Error | string): string {
    return (e as unknown) as string
  }

  /**
   * Run the given function synchronously.
   *
   * @param fn Function that will be executed.
   * @param value Input data for the given function.
   */
  protected run (
    fn: (data?: Data) => Response,
    value: MessageValue<Data>
  ): void {
    try {
      const res = fn(value.data)
      this.sendToMainWorker({ data: res, id: value.id })
      this.lastTask = Date.now()
    } catch (e) {
      const err = this.handleError(e)
      this.sendToMainWorker({ error: err, id: value.id })
      this.lastTask = Date.now()
    }
  }

  /**
   * Run the given function asynchronously.
   *
   * @param fn Function that will be executed.
   * @param value Input data for the given function.
   */
  protected runAsync (
    fn: (data?: Data) => Promise<Response>,
    value: MessageValue<Data>
  ): void {
    fn(value.data)
      .then(res => {
        this.sendToMainWorker({ data: res, id: value.id })
        this.lastTask = Date.now()
        return null
      })
      .catch(e => {
        const err = this.handleError(e)
        this.sendToMainWorker({ error: err, id: value.id })
        this.lastTask = Date.now()
      })
  }
}
