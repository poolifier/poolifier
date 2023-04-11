import type { ClusterSettings, Worker } from 'node:cluster'
import cluster from 'node:cluster'
import type { MessageValue } from '../../utility-types'
import { AbstractPool } from '../abstract-pool'
import type { PoolOptions } from '../pool'
import { PoolType } from '../pool'

/**
 * Options for a poolifier cluster pool.
 */
export interface ClusterPoolOptions extends PoolOptions<Worker> {
  /**
   * Key/value pairs to add to worker process environment.
   *
   * @see https://nodejs.org/api/cluster.html#cluster_cluster_fork_env
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env?: any
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
 * It is possible to perform tasks in sync or asynchronous mode as you prefer.
 *
 * This pool selects the workers in a round robin fashion.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
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
    public readonly opts: ClusterPoolOptions = {}
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
  public destroyWorker (worker: Worker): void {
    this.sendToWorker(worker, { kill: 1 })
    worker.kill()
  }

  /** @inheritDoc */
  protected sendToWorker (worker: Worker, message: MessageValue<Data>): void {
    worker.send(message)
  }

  /** @inheritDoc */
  protected registerWorkerMessageListener<Message extends Data | Response>(
    worker: Worker,
    listener: (message: MessageValue<Message>) => void
  ): void {
    worker.on('message', listener)
  }

  /** @inheritDoc */
  protected createWorker (): Worker {
    return cluster.fork(this.opts.env)
  }

  /** @inheritDoc */
  protected afterWorkerSetup (worker: Worker): void {
    // Listen to worker messages.
    this.registerWorkerMessageListener(worker, super.workerListener())
  }

  /** @inheritDoc */
  public get type (): PoolType {
    return PoolType.FIXED
  }

  /** @inheritDoc */
  protected get full (): boolean {
    return this.workerNodes.length === this.numberOfWorkers
  }

  /** @inheritDoc */
  protected get busy (): boolean {
    return this.internalBusy()
  }
}
