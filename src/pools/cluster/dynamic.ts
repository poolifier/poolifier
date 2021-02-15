import type { Worker } from 'cluster'
import type { JSONValue } from '../../utility-types'
import type { ClusterPoolOptions } from './fixed'
import { FixedClusterPool } from './fixed'

/**
 * A cluster pool with a dynamic number of workers, but a guaranteed minimum number of workers.
 *
 * This cluster pool creates new workers when the others are busy, up to the maximum number of workers.
 * When the maximum number of workers is reached, an event is emitted. If you want to listen to this event, use the pool's `emitter`.
 *
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 *
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
export class DynamicClusterPool<
  Data extends JSONValue = JSONValue,
  Response extends JSONValue = JSONValue
> extends FixedClusterPool<Data, Response> {
  /**
   * Constructs a new poolifier dynamic cluster pool.
   *
   * @param min Minimum number of workers which are always active.
   * @param max Maximum number of workers that can be created by this pool.
   * @param filename Path to an implementation of a `ClusterWorker` file, which can be relative or absolute.
   * @param opts Options for this fixed cluster pool. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    min: number,
    public readonly max: number,
    filename: string,
    opts: ClusterPoolOptions = { maxTasks: 1000 }
  ) {
    super(min, filename, opts)
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
    for (const [worker, numberOfTasks] of this.tasks) {
      if (numberOfTasks === 0) {
        // A worker is free, use it
        return worker
      }
    }

    if (this.workers.length === this.max) {
      this.emitter.emit('FullPool')
      return super.chooseWorker()
    }

    // All workers are busy, create a new worker
    const worker = this.createAndSetupWorker()
    this.registerWorkerMessageListener<Data>(worker, message => {
      const tasksInProgress = this.tasks.get(worker)
      if (message.kill && tasksInProgress === 0) {
        // Kill received from the worker, means that no new tasks are submitted to that worker for a while ( > maxInactiveTime)
        // To handle the case of a long-running task we will check if there is any active task
        this.sendToWorker(worker, { kill: 1 })
        void this.destroyWorker(worker)
      }
    })
    return worker
  }
}
