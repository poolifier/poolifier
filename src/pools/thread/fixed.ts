import { isMainThread, MessageChannel, SHARE_ENV, Worker } from 'worker_threads'
import type { Draft, MessageValue, ThisNeedsAName } from '../../utility-types'
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
   * The promise map.
   *
   * - `key`: This is the message ID of each submitted task.
   * - `value`: An object that contains the worker, the resolve function and the reject function.
   *
   * When we receive a message from the worker we get a map entry and resolve/reject the promise based on the message.
   */
  protected readonly promiseMap: Map<
    number,
    ThisNeedsAName<ThreadWorkerWithMessageChannel, Response>
  > = new Map<
    number,
    ThisNeedsAName<ThreadWorkerWithMessageChannel, Response>
  >()

  /**
   * Constructs a new poolifier fixed thread pool.
   *
   * @param numberOfThreads Number of threads for this pool.
   * @param filePath Path to an implementation of a `ThreadWorker` file, which can be relative or absolute.
   * @param opts Options for this fixed thread pool. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    numberOfThreads: number,
    filePath: string,
    opts: PoolOptions<ThreadWorkerWithMessageChannel> = { maxTasks: 1000 }
  ) {
    super(numberOfThreads, filePath, opts)
  }

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

  protected unregisterWorkerMessageListener<Message extends Data | Response> (
    messageChannel: ThreadWorkerWithMessageChannel,
    listener: (message: MessageValue<Message>) => void
  ): void {
    messageChannel.port2?.removeListener('message', listener)
  }

  protected createWorker (): ThreadWorkerWithMessageChannel {
    return new Worker(this.filePath, {
      env: SHARE_ENV
    })
  }

  protected internalExecute (
    worker: Worker,
    messageId: number
  ): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      this.promiseMap.set(messageId, { resolve, reject, worker })
    })
  }

  protected afterWorkerSetup (worker: ThreadWorkerWithMessageChannel): void {
    const { port1, port2 } = new MessageChannel()
    worker.postMessage({ parent: port1 }, [port1])
    worker.port1 = port1
    worker.port2 = port2
    // We will attach a listener for every task,
    // when the task is completed the listener will be removed but to avoid warnings we are increasing the max listeners size.
    worker.port2.setMaxListeners(this.opts.maxTasks ?? 1000)
    const listener: (message: MessageValue<Response>) => void = message => {
      if (message.id) {
        const value = this.promiseMap.get(message.id)
        if (value) {
          this.decreaseWorkersTasks(value.worker)
          if (message.error) value.reject(message.error)
          else value.resolve(message.data as Response)
          this.promiseMap.delete(message.id)
        }
      }
    }
    this.registerWorkerMessageListener(worker, listener)
  }
}
