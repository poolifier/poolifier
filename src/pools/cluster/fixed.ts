import { fork, isMaster, setupMaster, Worker } from 'cluster'
import type { MessageValue } from '../../utility-types'
import type { PoolOptions } from '../abstract-pool'
import { AbstractPool } from '../abstract-pool'

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
 * A cluster pool with a static number of workers, is possible to execute tasks in sync or async mode as you prefer.
 *
 * This pool will select the worker in a round robin fashion.
 *
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FixedClusterPool<Data = any, Response = any> extends AbstractPool<
  Worker,
  Data,
  Response
> {
  /**
   * @param numWorkers Number of workers for this pool.
   * @param filePath A file path with implementation of `ClusterWorker` class, relative path is fine.
   * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    numWorkers: number,
    filePath: string,
    public readonly opts: ClusterPoolOptions = { maxTasks: 1000 }
  ) {
    super(numWorkers, filePath, opts)
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
    worker.kill()
    // FIXME: The tests are currently failing, so these must be changed first
  }

  protected sendToWorker (worker: Worker, message: MessageValue<Data>): void {
    worker.send(message)
  }

  protected registerWorkerMessageListener (
    port: Worker,
    listener: (message: MessageValue<Response>) => void
  ): void {
    port.on('message', listener)
  }

  protected unregisterWorkerMessageListener (
    port: Worker,
    listener: (message: MessageValue<Response>) => void
  ): void {
    port.removeListener('message', listener)
  }

  protected newWorker (): Worker {
    return fork(this.opts.env)
  }

  protected afterNewWorkerPushed (worker: Worker): void {
    // we will attach a listener for every task,
    // when task is completed the listener will be removed but to avoid warnings we are increasing the max listeners size
    worker.setMaxListeners(this.opts.maxTasks ?? 1000)
  }
}
