import cluster, { type ClusterSettings, type Worker } from 'node:cluster'
import type { MessageValue } from '../../utility-types'
import { AbstractPool } from '../abstract-pool'
import { type PoolOptions, type PoolType, PoolTypes } from '../pool'
import { type WorkerType, WorkerTypes } from '../worker'

/**
 * Options for a poolifier cluster pool.
 */
export interface ClusterPoolOptions extends PoolOptions<Worker> {
  /**
   * Key/value pairs to add to worker process environment.
   *
   * @see https://nodejs.org/api/cluster.html#cluster_cluster_fork_env
   */
  env?: Record<string, unknown>
  /**
   * Cluster settings.
   *
   * @see https://nodejs.org/api/cluster.html#cluster_cluster_settings
   */
  settings?: ClusterSettings
}

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
    protected readonly opts: ClusterPoolOptions = {}
  ) {
    super(numberOfWorkers, filePath, opts)
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
    worker.once('disconnect', () => {
      worker.kill()
    })
    await this.sendKillMessageToWorker(workerNodeKey)
    worker.disconnect()
    await waitWorkerExit
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
  protected createWorker (): Worker {
    return cluster.fork(this.opts.env)
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
