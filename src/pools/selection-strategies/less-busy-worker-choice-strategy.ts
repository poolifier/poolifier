import type { IPoolWorker } from '../pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type { RequiredStatistics } from './selection-strategies-types'

/**
 * Selects the less busy worker.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export class LessBusyWorkerChoiceStrategy<
  Worker extends IPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  /** {@inheritDoc} */
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: true
  }

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
    let minRunTime = Infinity
    let lessBusyWorkerKey!: number
    for (const [index, workerItem] of this.pool.workers.entries()) {
      const workerRunTime = workerItem.tasksUsage.runTime
      if (workerRunTime === 0) {
        return index
      } else if (workerRunTime < minRunTime) {
        minRunTime = workerRunTime
        lessBusyWorkerKey = index
      }
    }
    return lessBusyWorkerKey
  }

  /** {@inheritDoc} */
  public remove (workerKey: number): boolean {
    return true
  }
}
