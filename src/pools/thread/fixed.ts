import { isMainThread, MessageChannel, SHARE_ENV, Worker } from 'worker_threads'
import type { Draft, MessageValue } from '../../utility-types'
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FixedThreadPool<Data = any, Response = any> extends AbstractPool<
  ThreadWorkerWithMessageChannel,
  Data,
  Response
> {
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

  protected internalExecute (
    worker: ThreadWorkerWithMessageChannel,
    id: number
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const listener: (message: MessageValue<Response>) => void = message => {
        if (message.id === id) {
          worker.port2?.removeListener('message', listener)
          const previousWorkerIndex = this.tasks.get(worker)
          if (previousWorkerIndex !== undefined) {
            this.tasks.set(worker, previousWorkerIndex + 1)
          } else {
            throw Error('Worker could not be found in tasks map')
          }
          if (message.error) reject(message.error)
          else resolve(message.data as Response)
        }
      }
      worker.port2?.on('message', listener)
    })
  }

  protected newWorker (): ThreadWorkerWithMessageChannel {
    const worker: ThreadWorkerWithMessageChannel = new Worker(this.filePath, {
      env: SHARE_ENV
    })
    worker.on('error', this.opts.errorHandler ?? (() => {}))
    worker.on('online', this.opts.onlineHandler ?? (() => {}))
    // TODO handle properly when a worker exit
    worker.on('exit', this.opts.exitHandler ?? (() => {}))
    this.workers.push(worker)
    const { port1, port2 } = new MessageChannel()
    worker.postMessage({ parent: port1 }, [port1])
    worker.port1 = port1
    worker.port2 = port2
    // we will attach a listener for every task,
    // when task is completed the listener will be removed but to avoid warnings we are increasing the max listeners size
    worker.port2.setMaxListeners(this.opts.maxTasks ?? 1000)
    // init tasks map
    this.tasks.set(worker, 0)
    return worker
  }
}
