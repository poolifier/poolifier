import type { MessagePort } from 'worker_threads'
import { isMainThread, parentPort } from 'worker_threads'
import type { MessageValue } from '../utility-types'
import { AbstractWorker } from './abstract-worker'
import { SharedUsage } from './shared-usage'
import type { WorkerOptions } from './worker-options'

/**
 * A thread worker used by a poolifier `ThreadPool`.
 *
 * When this worker is inactive for more than the given `maxInactiveTime`,
 * it will send a termination request to its main thread.
 *
 * If you use a `DynamicThreadPool` the extra workers that were created will be terminated,
 * but the minimum number of workers will be guaranteed.
 *
 * @template DataType of data this worker receives from pool's execution. This can only be serializable data.
 * @template ResponseType of response the worker sends back to the main thread. This can only be serializable data.
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class ThreadWorker<
  Data = unknown,
  Response = unknown
> extends AbstractWorker<MessagePort, Data, Response> {
  /**
   * Tasks shared usage statistics.
   */
  private tasksSharedUsage!: SharedUsage

  /**
   * Constructs a new poolifier thread worker.
   *
   * @param fn Function processed by the worker when the pool's `execution` function is invoked.
   * @param opts Options for the worker.
   */
  public constructor (fn: (data: Data) => Response, opts: WorkerOptions = {}) {
    super('worker-thread-pool:poolifier', isMainThread, fn, parentPort, opts)
  }

  protected messageListener (
    value: MessageValue<Data, MessagePort>,
    fn: (data: Data) => Response
  ): void {
    super.messageListener(value, fn)
    if (
      value.numberOfWorkers !== undefined &&
      value.tasksSharedUsage !== undefined
    ) {
      if (!this.tasksSharedUsage) {
        this.tasksSharedUsage = new SharedUsage(
          value.numberOfWorkers,
          value.tasksSharedUsage
        )
      }
    }
  }

  /** @inheritDoc */
  protected sendToMainWorker (message: MessageValue<Response>): void {
    this.getMainWorker().postMessage(message)
  }

  /** @inheritDoc */
  protected beforeRunHook (workerId: number | undefined): void {
    if (!this.tasksSharedUsage) {
      console.log('UNDEFINED')
      // this.tasksSharedUsage.consoleDump()
    }
    this.tasksSharedUsage[`worker${workerId as number}-running`]++
    this.tasksSharedUsage.consoleDump()
  }

  /** @inheritDoc */
  protected afterRunHook (
    workerId: number | undefined,
    taskRunTime: number
  ): void {
    this.tasksSharedUsage[`worker${workerId as number}-running`]--
    this.tasksSharedUsage[`worker${workerId as number}-run`]++
    // this.tasksSharedUsage.consoleDump()
    this.updateWorkerTasksRunTime(workerId, taskRunTime)
  }

  private updateWorkerTasksRunTime (
    workerId: number | undefined,
    taskRunTime: number
  ) {
    this.tasksSharedUsage[`worker${workerId as number}-runTime`] += taskRunTime
    if (this.tasksSharedUsage[`worker${workerId as number}-run`] !== 0) {
      this.tasksSharedUsage[`worker${workerId as number}-avgRunTime`] =
        this.tasksSharedUsage[`worker${workerId as number}-runTime`] /
        this.tasksSharedUsage[`worker${workerId as number}-run`]
    }
  }
}
