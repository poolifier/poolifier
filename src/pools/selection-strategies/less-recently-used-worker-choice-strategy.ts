import type { AbstractPoolWorker } from '../abstract-pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'

/**
 * Selects the less recently used worker.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export class LessRecentlyUsedWorkerChoiceStrategy<
  Worker extends AbstractPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  /** @inheritdoc */
  public choose (): Worker {
    let minNumberOfRunningTasks = Infinity
    // A worker is always found because it picks the one with fewer tasks
    let lessRecentlyUsedWorker!: Worker
    for (const worker of this.pool.workers) {
      const workerRunningTasks = this.pool.getWorkerRunningTasks(worker)
      if (!this.isDynamicPool && workerRunningTasks === 0) {
        return worker
      } else if (
        workerRunningTasks !== undefined &&
        workerRunningTasks < minNumberOfRunningTasks
      ) {
        lessRecentlyUsedWorker = worker
        minNumberOfRunningTasks = workerRunningTasks
      }
    }
    return lessRecentlyUsedWorker
  }
}
