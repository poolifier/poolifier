import { isMainThread, MessageChannel, SHARE_ENV, Worker } from 'worker_threads'
import type { Draft, MessageValue } from '../../utility-types'
import type { PoolOptions } from '../abstract-pool'
import { AbstractPool } from '../abstract-pool'

/**
 * A thread worker with message channels for communication between main thread and thread worker.
 */
export type ThreadWorkerWithMessageChannel = Worker & Draft<MessageChannel>

/**
 * A thread pool with a fixed number of threads.
 *
 * It is possible to perform tasks in sync or asynchronous mode as you prefer.
 *
 * This pool selects the threads in a round robin fashion.
 *
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FixedThreadPool<Data = any, Response = any> extends AbstractPool<
  ThreadWorkerWithMessageChannel,
  Data,
  Response
> {
  /**
   * Constructs a new poolifier fixed thread pool.
   *
   * @param numThreads Number of threads for this pool.
   * @param filePath Path to an implementation of a `ThreadWorker` file, which can be relative or absolute.
   * @param opts Options for this fixed thread pool. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    numThreads: number,
    filePath: string,
    opts: PoolOptions<ThreadWorkerWithMessageChannel> = { maxTasks: 1000 }
  ) {
    super(numThreads, filePath, opts)
  }

  protected isMain (): boolean {
    return isMainThread
  }

  protected async destroyWorker (
    worker: ThreadWorkerWithMessageChannel
  ): Promise<void> {
    await worker.terminate()
  }

  protected sendToWorker (
    worker: ThreadWorkerWithMessageChannel,
    message: MessageValue<Data>
  ): void {
    worker.postMessage(message)
  }

  protected registerWorkerMessageListener (
    port: ThreadWorkerWithMessageChannel,
    listener: (message: MessageValue<Response>) => void
  ): void {
    port.port2?.on('message', listener)
  }

  protected unregisterWorkerMessageListener (
    port: ThreadWorkerWithMessageChannel,
    listener: (message: MessageValue<Response>) => void
  ): void {
    port.port2?.removeListener('message', listener)
  }

  protected newWorker (): ThreadWorkerWithMessageChannel {
    return new Worker(this.filePath, {
      env: SHARE_ENV
    })
  }

  protected afterNewWorkerPushed (
    worker: ThreadWorkerWithMessageChannel
  ): void {
    const { port1, port2 } = new MessageChannel()
    worker.postMessage({ parent: port1 }, [port1])
    worker.port1 = port1
    worker.port2 = port2
    // we will attach a listener for every task,
    // when task is completed the listener will be removed but to avoid warnings we are increasing the max listeners size
    worker.port2.setMaxListeners(this.opts.maxTasks ?? 1000)
  }
}
