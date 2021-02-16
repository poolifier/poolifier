import type { JSONValue } from '../../utility-types'
import type { PoolOptions } from '../abstract-pool'
import type { ThreadWorkerWithMessageChannel } from './fixed'
import { FixedThreadPool } from './fixed'
import { killBehaviorEnumeration } from '../../worker/worker-options'

/**
 * A thread pool with a dynamic number of threads, but a guaranteed minimum number of threads.
 *
 * This thread pool creates new threads when the others are busy, up to the maximum number of threads.
 * When the maximum number of threads is reached, an event is emitted. If you want to listen to this event, use the pool's `emitter`.
 *
 * @template Data Type of data sent to the worker.
 * @template Response Type of response of execution.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class DynamicThreadPool<
  Data extends JSONValue = JSONValue,
  Response extends JSONValue = JSONValue
> extends FixedThreadPool<Data, Response> {
  /**
   * Constructs a new poolifier dynamic thread pool.
   *
   * @param min Minimum number of threads which are always active.
   * @param max Maximum number of threads that can be created by this pool.
   * @param filename Path to an implementation of a `ThreadWorker` file, which can be relative or absolute.
   * @param opts Options for this fixed thread pool. Default: `{ maxTasks: 1000 }`
   */
  public constructor (
    min: number,
    public readonly max: number,
    filename: string,
    opts: PoolOptions<ThreadWorkerWithMessageChannel> = { maxTasks: 1000 }
  ) {
    super(min, filename, opts)
  }

  /**
   * Choose a thread for the next task.
   *
   * It will first check for and return an idle thread.
   * If all threads are busy, then it will try to create a new one up to the `max` thread count.
   * If the max thread count is reached, the emitter will emit a `FullPool` event and it will fall back to using a round robin algorithm to distribute the load.
   *
   * @returns Thread worker.
   */
  protected chooseWorker (): ThreadWorkerWithMessageChannel {
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
      const isKillBehaviorOptionHard =
        message.kill === killBehaviorEnumeration.HARD
      if (isKillBehaviorOptionHard || tasksInProgress === 0) {
        // Kill received from the worker, means that no new tasks are submitted to that worker for a while ( > maxInactiveTime)
        this.sendToWorker(worker, { kill: 1 })
        void this.destroyWorker(worker)
      }
    })
    return worker
  }
}
