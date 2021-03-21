import { isMainThread, MessageChannel, SHARE_ENV, Worker } from 'worker_threads'
import type { Draft, MessageValue } from '../../utility-types'
import type { PoolOptions } from '../abstract-pool'
import { AbstractPool } from '../abstract-pool'
import { PoolType } from '../pool-internal'

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
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class FixedThreadPool<
  Data = unknown,
  Response = unknown
> extends AbstractPool<ThreadWorkerWithMessageChannel, Data, Response> {
  /**
   * Constructs a new poolifier fixed thread pool.
   *
   * @param numberOfThreads Number of threads for this pool.
   * @param filePath Path to an implementation of a `ThreadWorker` file, which can be relative or absolute.
   * @param opts Options for this fixed thread pool. Default: `{}`
   */
  public constructor (
    numberOfThreads: number,
    filePath: string,
    opts: PoolOptions<ThreadWorkerWithMessageChannel> = {}
  ) {
    super(numberOfThreads, filePath, opts)
  }

  /** @inheritdoc */
  protected isMain (): boolean {
    return isMainThread
  }

  /** @inheritdoc */
  public async destroyWorker (
    worker: ThreadWorkerWithMessageChannel
  ): Promise<void> {
    this.sendToWorker(worker, { kill: 1 })
    await worker.terminate()
  }

  /** @inheritdoc */
  protected sendToWorker (
    worker: ThreadWorkerWithMessageChannel,
    message: MessageValue<Data>
  ): void {
    worker.postMessage(message)
  }

  /** @inheritdoc */
  public registerWorkerMessageListener<Message extends Data | Response> (
    messageChannel: ThreadWorkerWithMessageChannel,
    listener: (message: MessageValue<Message>) => void
  ): void {
    messageChannel.port2?.on('message', listener)
  }

  /** @inheritdoc */
  protected createWorker (): ThreadWorkerWithMessageChannel {
    return new Worker(this.filePath, {
      env: SHARE_ENV
    })
  }

  /** @inheritdoc */
  protected afterWorkerSetup (worker: ThreadWorkerWithMessageChannel): void {
    const { port1, port2 } = new MessageChannel()
    worker.postMessage({ parent: port1 }, [port1])
    worker.port1 = port1
    worker.port2 = port2
    // Listen worker messages.
    this.registerWorkerMessageListener(worker, super.workerListener())
  }

  /** @inheritdoc */
  public get type (): PoolType {
    return PoolType.FIXED
  }

  /** @inheritdoc */
  public get busy (): boolean {
    return this.internalGetBusyStatus()
  }
}
