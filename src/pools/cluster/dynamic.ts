import type { Worker } from 'cluster'
import type { IPoolDynamicInternal } from '../pool-internal'
import { dynamicallyChooseWorker } from '../selection-strategies'
import type { ClusterPoolOptions } from './fixed'
import { FixedClusterPool } from './fixed'

/**
 * A cluster pool with a dynamic number of workers, but a guaranteed minimum number of workers.
 *
 * This cluster pool creates new workers when the others are busy, up to the maximum number of workers.
 * When the maximum number of workers is reached, an event is emitted. If you want to listen to this event, use the pool's `emitter`.
 *
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 *
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
export class DynamicClusterPool<Data = unknown, Response = unknown>
  extends FixedClusterPool<Data, Response>
  implements IPoolDynamicInternal<Worker, Data, Response> {
  /**
   * Constructs a new poolifier dynamic cluster pool.
   *
   * @param min Minimum number of workers which are always active.
   * @param max Maximum number of workers that can be created by this pool.
   * @param filePath Path to an implementation of a `ClusterWorker` file, which can be relative or absolute.
   * @param opts Options for this dynamic cluster pool. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    min: number,
    public readonly max: number,
    filePath: string,
    opts: ClusterPoolOptions = { maxTasks: 1000 }
  ) {
    super(min, filePath, opts)
    this.createAndSetupWorker = this.createAndSetupWorker.bind(this)
    this.registerWorkerMessageListener = this.registerWorkerMessageListener.bind(
      this
    )
    this.destroyWorker = this.destroyWorker.bind(this)
  }

  /**
   * Choose a worker for the next task.
   *
   * It will first check for and return an idle worker.
   * If all workers are busy, then it will try to create a new one up to the `max` worker count.
   * If the max worker count is reached, the emitter will emit a `FullPool` event and it will fall back to using a round robin algorithm to distribute the load.
   *
   * @returns Cluster worker.
   */
  protected chooseWorker (): Worker {
    return dynamicallyChooseWorker(
      this,
      this.createAndSetupWorker,
      this.registerWorkerMessageListener,
      this.destroyWorker
    )
  }
}
