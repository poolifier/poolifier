import cluster, { type Worker } from 'node:cluster'
import type { MessageValue } from '../../utility-types'
import { AbstractPool } from '../abstract-pool'
import { type PoolOptions, type PoolType, PoolTypes } from '../pool'
import { type WorkerType, WorkerTypes } from '../worker'

/**
 * A cluster pool with a fixed number of workers.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
export class FixedClusterPool<
  Data = unknown,
  Response = unknown
> extends AbstractPool<Worker, Data, Response> {
  /**
   * Constructs a new poolifier fixed cluster pool.
   *
   * @param numberOfWorkers - Number of workers for this pool.
   * @param filePath - Path to an implementation of a `ClusterWorker` file, which can be relative or absolute.
   * @param opts - Options for this fixed cluster pool.
   */
  public constructor (
    numberOfWorkers: number,
    filePath: string,
    opts: PoolOptions<Worker> = {},
    maximumNumberOfWorkers?: number
  ) {
    super(numberOfWorkers, filePath, opts, maximumNumberOfWorkers)
  }

  /** @inheritDoc */
  protected setupHook (): void {
    cluster.setupPrimary({ ...this.opts.settings, exec: this.filePath })
  }

  /** @inheritDoc */
  protected isMain (): boolean {
    return cluster.isPrimary
  }

  /** @inheritDoc */
  protected sendToWorker (
    workerNodeKey: number,
    message: MessageValue<Data>
  ): void {
    this.workerNodes[workerNodeKey].worker.send({
      ...message,
      workerId: this.getWorkerInfo(workerNodeKey).id as number
    })
  }

  /** @inheritDoc */
  protected sendStartupMessageToWorker (workerNodeKey: number): void {
    this.sendToWorker(workerNodeKey, {
      ready: false
    })
  }

  /** @inheritDoc */
  protected registerWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void {
    this.workerNodes[workerNodeKey].worker.on('message', listener)
  }

  /** @inheritDoc */
  protected registerOnceWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void {
    this.workerNodes[workerNodeKey].worker.once('message', listener)
  }

  /** @inheritDoc */
  protected deregisterWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void {
    this.workerNodes[workerNodeKey].worker.off('message', listener)
  }

  /** @inheritDoc */
  protected get type (): PoolType {
    return PoolTypes.fixed
  }

  /** @inheritDoc */
  protected get worker (): WorkerType {
    return WorkerTypes.cluster
  }

  /** @inheritDoc */
  protected get busy (): boolean {
    return this.internalBusy()
  }
}
