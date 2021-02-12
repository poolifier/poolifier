import { isMainThread, MessageChannel, SHARE_ENV, Worker } from 'worker_threads'
import type { Draft, JSONValue, MessageValue } from '../../utility-types'
import type { PoolOptions } from '../abstract-pool'
import { AbstractPool } from '../abstract-pool'

export type ThreadWorkerWithMessageChannel = Worker & Draft<MessageChannel>

/**
 * A thread pool with a static number of threads, is possible to execute tasks in sync or async mode as you prefer.
 *
 * This pool will select the worker thread in a round robin fashion.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class FixedThreadPool<
  Data extends JSONValue = JSONValue,
  Response extends JSONValue = JSONValue
> extends AbstractPool<ThreadWorkerWithMessageChannel, Data, Response> {
  /**
   * @param numThreads Num of threads for this worker pool.
   * @param filePath A file path with implementation of `ThreadWorker` class, relative path is fine.
   * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
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
