import { AsyncResource } from 'async_hooks'
import type { MessageValue } from '../utility-types'
import type { WorkerOptions } from './worker-options'

export abstract class AbstractWorker<
  MainWorker,
  Data = unknown,
  Response = unknown
> extends AsyncResource {
  protected readonly maxInactiveTime: number
  protected readonly async: boolean
  protected lastTask: number
  protected readonly interval?: NodeJS.Timeout

  /**
   *
   * @param type The type of async event.
   * @param isMain
   * @param fn
   * @param opts
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
    if (!fn) throw new Error('Fn parameter is mandatory')
    // keep the worker active
    if (!isMain) {
      this.interval = setInterval(
        this.checkAlive.bind(this),
        this.maxInactiveTime / 2
      )
      this.checkAlive.bind(this)()
    }
  }

  protected abstract getMainWorker (): MainWorker

  protected abstract sendToMainWorker (message: MessageValue<Response>): void

  protected checkAlive (): void {
    if (Date.now() - this.lastTask > this.maxInactiveTime) {
      this.sendToMainWorker({ kill: 1 })
    }
  }

  protected handleError (e: Error | string): string {
    return (e as unknown) as string
  }

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
