import { AsyncResource } from 'async_hooks'
import type { MessageValue } from '../utility-types'
import type { WorkerOptions } from './worker-options'

/**
 * Basic worker abstraction used for common logic between poolifier workers.
 *
 * @template MainWorker Type of main worker.
 * @template Data Type of data this worker receives from pool's execution.
 * @template Response Type of response the worker sends back to the main worker.
 */
export abstract class AbstractWorker<
  MainWorker,
  Data = unknown,
  Response = unknown
> extends AsyncResource {
  /**
   * Maximum time this worker can be alive. The pool will check and terminate this worker when the time expires.
   */
  protected readonly maxInactiveTime: number
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
   * @param opts Options for the worker.
   */
  public constructor (
    type: string,
    isMain: boolean,
    fn: (data: Data) => Response,
    public readonly opts: WorkerOptions = {}
  ) {
    super(type)

    this.maxInactiveTime = this.opts.maxInactiveTime ?? 1000 * 60
    this.async = !!this.opts.async
    this.lastTask = Date.now()
    if (!fn) throw new Error('fn parameter is mandatory')
    // keep the worker active
    if (!isMain) {
      this.interval = setInterval(
        this.checkAlive.bind(this),
        this.maxInactiveTime / 2
      )
      this.checkAlive.bind(this)()
    }
  }

  /**
   * Returns the main worker.
   */
  protected abstract getMainWorker (): MainWorker

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
      this.sendToMainWorker({ kill: 1 })
    }
  }

  /**
   * Handle an error and convert it to a string so it can be sent back to the main worker.
   *
   * @param e The error raised by the worker.
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
