import type { Worker } from 'cluster'
import type { JSONValue, MessageValue } from '../../utility-types'
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
   * Choose a worker in a round robin fashion.
   *
   * If all active workers are currently busy, try creating a new worker and using it.
   */
  protected chooseWorker (): Worker {
    let worker: Worker | undefined
    for (const entry of this.tasks) {
      if (entry[1] === 0) {
        worker = entry[0]
        break
      }
    }

    if (worker) {
      // A worker is free, use it
      return worker
    } else {
      if (this.workers.length === this.max) {
        this.emitter.emit('FullPool')
        return super.chooseWorker()
      }
      // All workers are busy, create a new worker
      const worker = this.internalNewWorker()
      worker.on('message', (message: MessageValue<Data>) => {
        if (message.kill) {
          this.sendToWorker(worker, { kill: 1 })
          void this.destroyWorker(worker)
          this.removeWorker(worker)
        }
      })
      return worker
    }
  }
}
