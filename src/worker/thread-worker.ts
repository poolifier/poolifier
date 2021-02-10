import { isMainThread, parentPort } from 'worker_threads'
import type { MessageValue } from '../utility-types'
import { AbstractWorker } from './abstract-worker'
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
export class ThreadWorker<Data = any, Response = any> extends AbstractWorker<
  Data,
  Response
> {
  protected parent?: MessagePort

  public constructor (fn: (data: Data) => Response, opts: WorkerOptions = {}) {
    super('worker-thread-pool:pioardi', isMainThread, fn, opts)

    parentPort?.on('message', (value: MessageValue<Data>) => {
      if (value?.data && value.id) {
        // here you will receive messages
        // console.log('This is the main thread ' + isMainThread)
        if (this.async) {
          this.runInAsyncScope(this.runAsync.bind(this), this, fn, value)
        } else {
          this.runInAsyncScope(this.run.bind(this), this, fn, value)
        }
      } else if (value.parent) {
        // save the port to communicate with the main thread
        // this will be received once
        this.parent = value.parent
      } else if (value.kill) {
        // here is time to kill this thread, just clearing the interval
        if (this.interval) clearInterval(this.interval)
        this.emitDestroy()
      }
    })
  }

  protected checkAlive (): void {
    if (Date.now() - this.lastTask > this.maxInactiveTime) {
      this.parent?.postMessage({ kill: 1 })
    }
  }

  protected run (
    fn: (data?: Data) => Response,
    value: MessageValue<Data>
  ): void {
    try {
      const res = fn(value.data)
      this.parent?.postMessage({ data: res, id: value.id })
      this.lastTask = Date.now()
    } catch (e) {
      this.parent?.postMessage({ error: e, id: value.id })
      this.lastTask = Date.now()
    }
  }

  protected runAsync (
    fn: (data?: Data) => Promise<Response>,
    value: MessageValue<Data>
  ): void {
    fn(value.data)
      .then(res => {
        this.parent?.postMessage({ data: res, id: value.id })
        this.lastTask = Date.now()
        return null
      })
      .catch(e => {
        this.parent?.postMessage({ error: e, id: value.id })
        this.lastTask = Date.now()
      })
  }
}
