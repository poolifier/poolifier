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
  public choose (): Worker {
    let minRunTime = Infinity
    let lessBusyWorker!: Worker
    for (const workerItem of this.pool.workers) {
      const worker = workerItem.worker
      const workerRunTime = this.pool.getWorkerTasksUsage(worker)
        ?.runTime as number
      if (!this.isDynamicPool && workerRunTime === 0) {
        return worker
      } else if (workerRunTime < minRunTime) {
        minRunTime = workerRunTime
        lessBusyWorker = worker
      }
    }
    return lessBusyWorker
  }
}
