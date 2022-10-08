import type { Worker } from 'cluster'
import cluster from 'cluster'
import type { MessageValue } from '../../utility-types'
import { AbstractPool } from '../abstract-pool'
import type { PoolOptions } from '../pool'
import { PoolType } from '../pool-internal'

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
}

/**
 * A cluster pool with a fixed number of workers.
 *
 * It is possible to perform tasks in sync or asynchronous mode as you prefer.
 *
 * This pool selects the workers in a round robin fashion.
 *
 * @template DataType of data sent to the worker. This can only be serializable data.
 * @template ResponseType of response of execution. This can only be serializable data.
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
   * @param numberOfWorkers Number of workers for this pool.
   * @param filePath Path to an implementation of a `ClusterWorker` file, which can be relative or absolute.
   * @param [opts={}] Options for this fixed cluster pool.
   */
  public constructor (
    numberOfWorkers: number,
    filePath: string,
    public readonly opts: ClusterPoolOptions = {}
  ) {
    super(numberOfWorkers, filePath, opts)
  }

  /** @inheritdoc */
  protected setupHook (): void {
    cluster.setupPrimary({
      exec: this.filePath
    })
  }

  /** @inheritdoc */
  protected isMain (): boolean {
    return cluster.isPrimary
  }

  /** @inheritdoc */
  public getWorkerRunningTasks (worker: Worker): number | undefined {
    return this.workersTasksUsage.get(worker)?.running ?? 0
  }

  /** @inheritdoc */
  public getWorkerAverageTasksRunTime (worker: Worker): number {
    return this.workersTasksUsage.get(worker)?.avgRunTime ?? 0
  }

  /** @inheritdoc */
  public destroyWorker (worker: Worker): void {
    this.sendToWorker(worker, { kill: 1 })
    worker.kill()
  }

  /** @inheritdoc */
  protected sendToWorker (worker: Worker, message: MessageValue<Data>): void {
    worker.send(message)
  }

  /** @inheritdoc */
  public registerWorkerMessageListener<Message extends Data | Response> (
    worker: Worker,
    listener: (message: MessageValue<Message>) => void
  ): void {
    worker.on('message', listener)
  }

  /** @inheritdoc */
  protected createWorker (): Worker {
    return cluster.fork(this.opts.env)
  }

  /** @inheritdoc */
  protected afterWorkerSetup (worker: Worker): void {
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
