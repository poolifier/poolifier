import { AsyncResource } from 'async_hooks'
import { isMaster, worker } from 'cluster'
import type { MessageValue } from '../utility-types'
import type { WorkerOptions } from './worker-options'

/**
 * An example worker that will be always alive, you just need to **extend** this class if you want a static pool.
 *
 * When this worker is inactive for more than 1 minute, it will send this info to the main thread,
 * if you are using DynamicThreadPool, the workers created after will be killed, the min num of thread will be guaranteed.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ClusterWorker<Data = any, Response = any> extends AsyncResource {
  protected readonly maxInactiveTime: number
  protected readonly async: boolean
  protected lastTask: number
  protected readonly interval?: NodeJS.Timeout
  // protected parent: MessagePort

  public constructor (
    fn: (data: Data) => Response,
    public readonly opts: WorkerOptions = {}
  ) {
    super('worker-cluster-pool:pioardi')

    this.maxInactiveTime = this.opts.maxInactiveTime ?? 1000 * 60
    this.async = !!this.opts.async
    this.lastTask = Date.now()
    if (!fn) throw new Error('Fn parameter is mandatory')
    // keep the worker active
    if (!isMaster) {
      // console.log('ClusterWorker#constructor', 'is not master')
      this.interval = setInterval(
        this.checkAlive.bind(this),
        this.maxInactiveTime / 2
      )
      this.checkAlive.bind(this)()
    }
    worker.on('message', (value: MessageValue<Data>) => {
      // console.log("cluster.on('message', value)", value)
      if (value?.data && value.id) {
        // here you will receive messages
        // console.log('This is the main thread ' + isMainThread)
        if (this.async) {
          this.runInAsyncScope(this.runAsync.bind(this), this, fn, value)
        } else {
          this.runInAsyncScope(this.run.bind(this), this, fn, value)
        }
        // } else if (value.parent) {
        //     // save the port to communicate with the main thread
        //     // this will be received once
        //     this.parent = value.parent
      } else if (value.kill) {
        // here is time to kill this thread, just clearing the interval
        if (this.interval) clearInterval(this.interval)
        this.emitDestroy()
      }
    })
  }

  protected checkAlive (): void {
    if (Date.now() - this.lastTask > this.maxInactiveTime) {
      worker.send({ kill: 1 })
    }
  }

  protected run (
    fn: (data: Data) => Response,
    value: MessageValue<Data>
  ): void {
    try {
      const res: Response = fn(value.data as Data)
      worker.send({ data: res, id: value.id })
      this.lastTask = Date.now()
    } catch (e) {
      const err = e instanceof Error ? e.message : e
      worker.send({ error: err, id: value.id })
      this.lastTask = Date.now()
    }
  }

  protected runAsync (
    fn: (data?: Data) => Promise<Response>,
    value: MessageValue<Data>
  ): void {
    fn(value.data)
      .then(res => {
        worker.send({ data: res, id: value.id })
        this.lastTask = Date.now()
      })
      .catch(e => {
        const err = e instanceof Error ? e.message : e
        worker.send({ error: err, id: value.id })
        this.lastTask = Date.now()
      })
  }
}
