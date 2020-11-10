import { isMainThread, parentPort } from 'worker_threads'
import { AsyncResource } from 'async_hooks'

export interface ThreadWorkerOptions {
  /**
   * Max time to wait tasks to work on (in ms), after this period the new worker threads will die.
   *
   * @default 60.000 ms
   */
  maxInactiveTime?: number
  /**
   * `true` if your function contains async pieces, else `false`.
   *
   * @default false
   */
  async?: boolean
}

/**
 * An example worker that will be always alive, you just need to **extend** this class if you want a static pool.
 *
 * When this worker is inactive for more than 1 minute, it will send this info to the main thread,
 * if you are using DynamicThreadPool, the workers created after will be killed, the min num of thread will be guaranteed.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class ThreadWorker<Data = any, Response = any> extends AsyncResource {
  protected readonly maxInactiveTime: number
  protected readonly async: boolean
  protected lastTask: number
  protected readonly interval: NodeJS.Timeout
  protected parent: any

  public constructor (
    fn: (data: Data) => Response,
    public readonly opts: ThreadWorkerOptions = {}
  ) {
    super('worker-thread-pool:pioardi')

    this.maxInactiveTime = this.opts.maxInactiveTime || 1000 * 60
    this.async = !!this.opts.async
    this.lastTask = Date.now()
    if (!fn) throw new Error('Fn parameter is mandatory')
    // keep the worker active
    if (!isMainThread) {
      this.interval = setInterval(
        this._checkAlive.bind(this),
        this.maxInactiveTime / 2
      )
      this._checkAlive.bind(this)()
    }
    parentPort.on('message', (value) => {
      if (value && value.data && value._id) {
        // here you will receive messages
        // console.log('This is the main thread ' + isMainThread)
        if (this.async) {
          this.runInAsyncScope(this._runAsync.bind(this), this, fn, value)
        } else {
          this.runInAsyncScope(this._run.bind(this), this, fn, value)
        }
      } else if (value.parent) {
        // save the port to communicate with the main thread
        // this will be received once
        this.parent = value.parent
      } else if (value.kill) {
        // here is time to kill this thread, just clearing the interval
        clearInterval(this.interval)
        this.emitDestroy()
      }
    })
  }

  protected _checkAlive (): void {
    if (Date.now() - this.lastTask > this.maxInactiveTime) {
      this.parent.postMessage({ kill: 1 })
    }
  }

  protected _run (
    fn: (data: Data) => Response,
    value: { readonly data: Data, readonly _id: number }
  ): void {
    try {
      const res = fn(value.data)
      this.parent.postMessage({ data: res, _id: value._id })
      this.lastTask = Date.now()
    } catch (e) {
      this.parent.postMessage({ error: e, _id: value._id })
      this.lastTask = Date.now()
    }
  }

  protected _runAsync (
    fn: (data: Data) => Promise<Response>,
    value: { readonly data: Data, readonly _id: number }
  ): void {
    fn(value.data)
      .then((res) => {
        this.parent.postMessage({ data: res, _id: value._id })
        this.lastTask = Date.now()
      })
      .catch((e) => {
        this.parent.postMessage({ error: e, _id: value._id })
        this.lastTask = Date.now()
      })
  }
}
