import {
  type MessageChannel,
  type MessagePort,
  SHARE_ENV,
  type TransferListItem,
  Worker,
  type WorkerOptions,
  isMainThread
} from 'node:worker_threads'
import type { MessageValue } from '../../utility-types'
import { AbstractPool } from '../abstract-pool'
import { type PoolOptions, type PoolType, PoolTypes } from '../pool'
import { type WorkerType, WorkerTypes } from '../worker'

/**
 * Options for a poolifier thread pool.
 */
export interface ThreadPoolOptions extends PoolOptions<Worker> {
  /**
   * Worker options.
   *
   * @see https://nodejs.org/api/worker_threads.html#new-workerfilename-options
   */
  workerOptions?: WorkerOptions
}

/**
 * A thread pool with a fixed number of threads.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class FixedThreadPool<
  Data = unknown,
  Response = unknown
> extends AbstractPool<Worker, Data, Response> {
  /**
   * Constructs a new poolifier fixed thread pool.
   *
   * @param numberOfThreads - Number of threads for this pool.
   * @param filePath - Path to an implementation of a `ThreadWorker` file, which can be relative or absolute.
   * @param opts - Options for this fixed thread pool.
   */
  public constructor (
    numberOfThreads: number,
    filePath: string,
    protected readonly opts: ThreadPoolOptions = {}
  ) {
    super(numberOfThreads, filePath, opts)
  }

  /** @inheritDoc */
  protected isMain (): boolean {
    return isMainThread
  }

  /** @inheritDoc */
  protected async destroyWorkerNode (workerNodeKey: number): Promise<void> {
    this.flagWorkerNodeAsNotReady(workerNodeKey)
    this.flushTasksQueue(workerNodeKey)
    // FIXME: wait for tasks to be finished
    const workerNode = this.workerNodes[workerNodeKey]
    const worker = workerNode.worker
    const waitWorkerExit = new Promise<void>(resolve => {
      worker.once('exit', () => {
        resolve()
      })
    })
    await this.sendKillMessageToWorker(workerNodeKey)
    workerNode.closeChannel()
    workerNode.removeAllListeners()
    await worker.terminate()
    await waitWorkerExit
  }

  /** @inheritDoc */
  protected sendToWorker (
    workerNodeKey: number,
    message: MessageValue<Data>,
    transferList?: TransferListItem[]
  ): void {
    (
      this.workerNodes[workerNodeKey]?.messageChannel as MessageChannel
    )?.port1?.postMessage(
      { ...message, workerId: this.getWorkerInfo(workerNodeKey).id },
      transferList
    )
  }

  /** @inheritDoc */
  protected sendStartupMessageToWorker (workerNodeKey: number): void {
    const workerNode = this.workerNodes[workerNodeKey]
    const port2: MessagePort = (workerNode.messageChannel as MessageChannel)
      .port2
    workerNode.worker.postMessage(
      {
        ready: false,
        workerId: this.getWorkerInfo(workerNodeKey).id,
        port: port2
      },
      [port2]
    )
  }

  /** @inheritDoc */
  protected registerWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void {
    (
      this.workerNodes[workerNodeKey]?.messageChannel as MessageChannel
    ).port1.on('message', listener)
  }

  /** @inheritDoc */
  protected registerOnceWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void {
    (
      this.workerNodes[workerNodeKey]?.messageChannel as MessageChannel
    ).port1.once('message', listener)
  }

  /** @inheritDoc */
  protected deregisterWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void {
    (
      this.workerNodes[workerNodeKey]?.messageChannel as MessageChannel
    ).port1.off('message', listener)
  }

  /** @inheritDoc */
  protected createWorker (): Worker {
    return new Worker(this.filePath, {
      env: SHARE_ENV,
      ...this.opts.workerOptions
    })
  }

  /** @inheritDoc */
  protected get type (): PoolType {
    return PoolTypes.fixed
  }

  /** @inheritDoc */
  protected get worker (): WorkerType {
    return WorkerTypes.thread
  }

  /** @inheritDoc */
  protected get busy (): boolean {
    return this.internalBusy()
  }
}
