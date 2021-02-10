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
  MessagePort,
  Data,
  Response
> {
  protected parent?: MessagePort

  public constructor (fn: (data: Data) => Response, opts: WorkerOptions = {}) {
    super('worker-thread-pool:pioardi', isMainThread, fn, opts)

    parentPort?.on('message', (value: MessageValue<Data>) => {
      if (value?.data && value.id) {
        // here you will receive messages
        // console.log('This is the main worker ' + isMain)
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
        // here is time to kill this worker, just clearing the interval
        if (this.interval) clearInterval(this.interval)
        this.emitDestroy()
      }
    })
  }

  protected getMainWorker (): MessagePort {
    if (!this.parent) {
      throw new Error('Parent was not set')
    }
    return this.parent
  }

  protected sendToMainWorker (message: MessageValue<Response>): void {
    this.getMainWorker().postMessage(message)
  }
}
