import type { MessagePort } from 'worker_threads'
import { isMainThread, parentPort } from 'worker_threads'
import type { MessageValue } from '../utility-types'
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
 * @template Data Type of data this worker receives from pool's execution. This can only be serializable data.
 * @template Response Type of response the worker sends back to the main thread. This can only be serializable data.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class ThreadWorker<
  Data = unknown,
  Response = unknown
> extends AbstractWorker<MessagePort, Data, Response> {
  /**
   * Constructs a new poolifier thread worker.
   *
   * @param fn Function processed by the worker when the pool's `execution` function is invoked.
   * @param opts Options for the worker.
   */
  public constructor (fn: (data: Data) => Response, opts: WorkerOptions = {}) {
    super('worker-thread-pool:pioardi', isMainThread, fn, parentPort, opts)
  }

  /** @inheritdoc */
  protected sendToMainWorker (message: MessageValue<Response>): void {
    this.getMainWorker().postMessage(message)
  }
}
