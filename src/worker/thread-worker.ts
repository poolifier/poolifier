import {
  type MessagePort,
  isMainThread,
  parentPort,
  threadId
} from 'node:worker_threads'
import type { MessageValue } from '../utility-types'
import { AbstractWorker } from './abstract-worker'
import type { WorkerOptions } from './worker-options'
import type { TaskFunctions, WorkerFunction } from './worker-functions'

/**
 * A thread worker used by a poolifier `ThreadPool`.
 *
 * When this worker is inactive for more than the given `maxInactiveTime`,
 * it will send a termination request to its main thread.
 *
 * If you use a `DynamicThreadPool` the extra workers that were created will be terminated,
 * but the minimum number of workers will be guaranteed.
 *
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be structured-cloneable data.
 * @typeParam Response - Type of response the worker sends back to the main thread. This can only be structured-cloneable data.
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
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execution` function is invoked.
   * @param opts - Options for the worker.
   */
  public constructor (
    taskFunctions:
    | WorkerFunction<Data, Response>
    | TaskFunctions<Data, Response>,
    opts: WorkerOptions = {}
  ) {
    super(
      'worker-thread-pool:poolifier',
      isMainThread,
      taskFunctions,
      parentPort as MessagePort,
      opts
    )
    if (!this.isMain) {
      this.sendToMainWorker({ workerId: this.id, started: true })
    }
  }

  protected get id (): number {
    return threadId
  }

  /** @inheritDoc */
  protected sendToMainWorker (message: MessageValue<Response>): void {
    console.log('sending message to main worker(thread)', message)
    this.getMainWorker().postMessage(message)
  }
}
