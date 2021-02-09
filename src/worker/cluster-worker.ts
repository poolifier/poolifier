/* eslint-disable @typescript-eslint/strict-boolean-expressions */

import * as cluster from 'cluster'

import { AsyncResource } from 'async_hooks'
import { MessageValue } from '../utility-types'
import { WorkerOptions } from './worker-options'

/**
 * An example worker that will be always alive, you just need to **extend** this class if you want a static pool.
 *
 * When this worker is inactive for more than 1 minute, it will send this info to the main thread,
 * if you are using DynamicThreadPool, the workers created after will be killed, the min num of thread will be guaranteed.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
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
    if (!cluster.isMaster) {
      // console.log('ClusterWorker#constructor', 'is not master')
      this.interval = setInterval(
        this.checkAlive.bind(this),
        this.maxInactiveTime / 2
      )
      this.checkAlive.bind(this)()
    }
    cluster.worker.on('message', (value: MessageValue<Data>) => {
      // console.log("cluster.on('message', value)", value)
      if (value && value.data && value.id) {
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
      cluster.worker.send({ kill: 1 })
    }
  }

  protected run (
    fn: (data: Data) => Response,
    value: MessageValue<Data>
  ): void {
    try {
      const res: Response = fn(value.data)
      cluster.worker.send({ data: res, id: value.id })
      this.lastTask = Date.now()
    } catch (e) {
      cluster.worker.send({ error: e, id: value.id })
      this.lastTask = Date.now()
    }
  }

  protected runAsync (
    fn: (data: Data) => Promise<Response>,
    value: MessageValue<Data>
  ): void {
    fn(value.data)
      .then(res => {
        cluster.worker.send({ data: res, id: value.id })
        this.lastTask = Date.now()
      })
      .catch(e => {
        cluster.worker.send({ error: e, id: value.id })
        this.lastTask = Date.now()
      })
  }
}
