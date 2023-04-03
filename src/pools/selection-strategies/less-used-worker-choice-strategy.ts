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
  public choose (): number {
    const freeWorkerKey = this.pool.findFreeWorkerKey()
    if (!this.isDynamicPool && freeWorkerKey !== false) {
      return freeWorkerKey
    }
    let minNumberOfTasks = Infinity
    let lessUsedWorkerKey!: number
    for (const [index, workerItem] of this.pool.workers.entries()) {
      const tasksUsage = workerItem.tasksUsage
      const workerTasks = tasksUsage?.run + tasksUsage?.running
      if (workerTasks === 0) {
        return index
      } else if (workerTasks < minNumberOfTasks) {
        minNumberOfTasks = workerTasks
        lessUsedWorkerKey = index
      }
    }
    return lessUsedWorkerKey
  }

  /** {@inheritDoc} */
  public remove (workerKey: number): boolean {
    return true
  }
}
