import type { IPoolWorker } from '../pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'

/**
 * Selects the less used worker.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export class LessUsedWorkerChoiceStrategy<
  Worker extends IPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  /** {@inheritDoc} */
  public reset (): boolean {
    return true
  }

  /** {@inheritDoc} */
  public choose (): Worker {
    let minNumberOfTasks = Infinity
    let lessUsedWorker!: Worker
    for (const workerItem of this.pool.workers) {
      const worker = workerItem.worker
      const tasksUsage = this.pool.getWorkerTasksUsage(worker)
      const workerTasks =
        (tasksUsage?.run as number) + (tasksUsage?.running as number)
      if (!this.isDynamicPool && workerTasks === 0) {
        return worker
      } else if (workerTasks < minNumberOfTasks) {
        minNumberOfTasks = workerTasks
        lessUsedWorker = worker
      }
    }
    return lessUsedWorker
  }
}
