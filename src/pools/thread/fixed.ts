import {
  isMainThread,
  type TransferListItem,
  type Worker
} from 'node:worker_threads'

import type { MessageValue } from '../../utility-types.js'
import { AbstractPool } from '../abstract-pool.js'
import { type PoolOptions, type PoolType, PoolTypes } from '../pool.js'
import { type WorkerType, WorkerTypes } from '../worker.js'

/**
 * Options for a poolifier thread pool.
 */
export type ThreadPoolOptions = PoolOptions<Worker>

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
    opts: ThreadPoolOptions = {},
    maximumNumberOfThreads?: number
  ) {
    super(numberOfThreads, filePath, opts, maximumNumberOfThreads)
  }

  /** @inheritDoc */
  protected isMain (): boolean {
    return isMainThread
  }

  /** @inheritDoc */
  protected sendToWorker (
    workerNodeKey: number,
    message: MessageValue<Data>,
    transferList?: readonly TransferListItem[]
  ): void {
    this.workerNodes[workerNodeKey]?.messageChannel?.port1.postMessage(
      {
        ...message,
        workerId: this.getWorkerInfo(workerNodeKey)?.id
      } satisfies MessageValue<Data>,
      transferList
    )
  }

  /** @inheritDoc */
  protected sendStartupMessageToWorker (workerNodeKey: number): void {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const port2 = workerNode.messageChannel!.port2
    workerNode.worker.postMessage(
      {
        ready: false,
        workerId: this.getWorkerInfo(workerNodeKey)?.id,
        port: port2
      } satisfies MessageValue<Data>,
      [port2]
    )
  }

  /** @inheritDoc */
  protected registerWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void {
    this.workerNodes[workerNodeKey].messageChannel?.port1.on(
      'message',
      listener
    )
  }

  /** @inheritDoc */
  protected registerOnceWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void {
    this.workerNodes[workerNodeKey].messageChannel?.port1.once(
      'message',
      listener
    )
  }

  /** @inheritDoc */
  protected deregisterWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void {
    this.workerNodes[workerNodeKey].messageChannel?.port1.off(
      'message',
      listener
    )
  }

  /** @inheritDoc */
  protected shallCreateDynamicWorker (): boolean {
    return false
  }

  /** @inheritDoc */
  protected checkAndEmitDynamicWorkerCreationEvents (): void {
    /* noop */
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
