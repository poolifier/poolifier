import type { IPoolWorker } from '../pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type { RequiredStatistics } from './selection-strategies-types'

/**
 * Worker virtual task timestamp.
 */
type WorkerVirtualTaskTimestamp = {
  start: number
  end: number
}

/**
 * Selects the next worker with a fair share scheduling algorithm.
 * Loosely modeled after the fair queueing algorithm: https://en.wikipedia.org/wiki/Fair_queuing.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export class FairShareWorkerChoiceStrategy<
  Worker extends IPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  /** @inheritDoc */
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: true
  }

  /**
   *  Worker last virtual task execution timestamp.
   */
  private readonly workerLastVirtualTaskTimestamp: Map<
    Worker,
    WorkerVirtualTaskTimestamp
  > = new Map<Worker, WorkerVirtualTaskTimestamp>()

  /** @inheritDoc */
  public reset (): boolean {
    this.workerLastVirtualTaskTimestamp.clear()
    return true
  }

  /** @inheritDoc */
  public choose (): Worker {
    let minWorkerVirtualTaskEndTimestamp = Infinity
    let chosenWorker!: Worker
    for (const worker of this.pool.workers) {
      this.computeWorkerLastVirtualTaskTimestamp(worker)
      const workerLastVirtualTaskEndTimestamp =
        this.workerLastVirtualTaskTimestamp.get(worker)?.end ?? 0
      if (
        workerLastVirtualTaskEndTimestamp < minWorkerVirtualTaskEndTimestamp
      ) {
        minWorkerVirtualTaskEndTimestamp = workerLastVirtualTaskEndTimestamp
        chosenWorker = worker
      }
    }
    return chosenWorker
  }

  /**
   * Computes worker last virtual task timestamp.
   *
   * @param worker The worker.
   */
  private computeWorkerLastVirtualTaskTimestamp (worker: Worker): void {
    const workerVirtualTaskStartTimestamp = Math.max(
      Date.now(),
      this.workerLastVirtualTaskTimestamp.get(worker)?.end ?? -Infinity
    )
    const workerVirtualTaskEndTimestamp =
      workerVirtualTaskStartTimestamp +
      (this.pool.getWorkerAverageTasksRunTime(worker) ?? 0)
    this.workerLastVirtualTaskTimestamp.set(worker, {
      start: workerVirtualTaskStartTimestamp,
      end: workerVirtualTaskEndTimestamp
    })
  }
}
