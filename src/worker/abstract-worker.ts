import { AsyncResource } from 'async_hooks'
import type { MessageValue } from '../utility-types'
import type { WorkerOptions } from './worker-options'

export abstract class AbstractWorker<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Response = any
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

  protected abstract checkAlive (): void

  protected abstract run (
    fn: (data?: Data) => Response,
    value: MessageValue<Data>
  ): void

  protected abstract runAsync (
    fn: (data?: Data) => Promise<Response>,
    value: { readonly data: Data; readonly id: number }
  ): void
}
