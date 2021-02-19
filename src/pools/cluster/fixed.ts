import { fork, isMaster, setupMaster, Worker } from 'cluster'
import type { MessageValue } from '../../utility-types'
import type { PoolOptions } from '../abstract-pool'
import { AbstractPool } from '../abstract-pool'

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
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 *
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
   * @param opts Options for this fixed cluster pool. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    numberOfWorkers: number,
    filePath: string,
    public readonly opts: ClusterPoolOptions = { maxTasks: 1000 }
  ) {
    super(numberOfWorkers, filePath, opts)
  }

  protected setupHook (): void {
    setupMaster({
      exec: this.filePath
    })
  }

  protected isMain (): boolean {
    return isMaster
  }

  protected destroyWorker (worker: Worker): void {
    this.sendToWorker(worker, { kill: 1 })
    worker.kill()
  }

  protected sendToWorker (worker: Worker, message: MessageValue<Data>): void {
    worker.send(message)
  }

  protected registerWorkerMessageListener<Message extends Data | Response> (
    worker: Worker,
    listener: (message: MessageValue<Message>) => void
  ): void {
    worker.on('message', listener)
  }

  protected unregisterWorkerMessageListener<Message extends Data | Response> (
    worker: Worker,
    listener: (message: MessageValue<Message>) => void
  ): void {
    worker.removeListener('message', listener)
  }

  protected createWorker (): Worker {
    return fork(this.opts.env)
  }

  protected afterWorkerSetup (worker: Worker): void {
    // we will attach a listener for every task,
    // when task is completed the listener will be removed but to avoid warnings we are increasing the max listeners size
    worker.setMaxListeners(this.opts.maxTasks ?? 1000)
  }
}
