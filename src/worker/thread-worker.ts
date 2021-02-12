import { isMainThread, parentPort } from 'worker_threads'
import type { JSONValue, MessageValue } from '../utility-types'
import { AbstractWorker } from './abstract-worker'
import type { WorkerOptions } from './worker-options'

/**
 * A thread worker used by a poolifier `ThreadPool`.
 *
 * When this worker is inactive for more than the given `maxInactiveTime`,
 * it will send a termination request to its main thread.
 *
 * If you use a `DynamicThreadPool` the extra workers that were created will be terminated,
 * but the minimum number of workers will be guaranteed.
 *
 * @template Data Type of data this worker receives from pool's execution.
 * @template Response Type of response the worker sends back to the main thread.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class ThreadWorker<
  Data extends JSONValue = JSONValue,
  Response extends JSONValue = JSONValue
> extends AbstractWorker<MessagePort, Data, Response> {
  /**
   * Reference to main thread.
   */
  protected parent?: MessagePort

  /**
   * Constructs a new poolifier thread worker.
   *
   * @param fn Function processed by the worker when the pool's `execution` function is invoked.
   * @param opts Options for the worker.
   */
  public constructor (fn: (data: Data) => Response, opts: WorkerOptions = {}) {
    super('worker-thread-pool:pioardi', isMainThread, fn, opts)

    parentPort?.on('message', (value: MessageValue<Data>) => {
      if (value?.data && value.id) {
        // here you will receive messages
        // console.log('This is the main worker ' + isMainThread)
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
