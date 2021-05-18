import type { IWorker } from '../abstract-pool'
import type { IPoolInternal } from '../pool-internal'
import type { IWorkerChoiceStrategy } from './selection-strategies-types'

/**
 * Selects the next worker with a fair share tasks scheduling algorithm.
 * Loosely modeled after the fair queueing algorithm: https://en.wikipedia.org/wiki/Fair_queuing.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export class FairShareWorkerChoiceStrategy<
  Worker extends IWorker,
  Data,
  Response
> implements IWorkerChoiceStrategy<Worker> {
  /**
   *  Worker last virtual task execution end timestamp.
   */
  private workerLastVirtualTaskFinishTimestamp: Map<Worker, number> = new Map<
    Worker,
    number
  >()

  /**
   * Constructs a worker choice strategy that selects based a fair share tasks scheduling algorithm.
   *
   * @param pool The pool instance.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>
  ) {}

  /** @inheritdoc */
  public choose (): Worker {
    let minWorkerVirtualTaskFinishPredictedTimestamp = Infinity
    let chosenWorker!: Worker
    for (const worker of this.pool.workers) {
      const workerLastVirtualTaskFinishPredictedTimestamp = this.getWorkerLastVirtualTaskFinishPredictedTimestamp(
        worker
      )
      if (
        workerLastVirtualTaskFinishPredictedTimestamp <
        minWorkerVirtualTaskFinishPredictedTimestamp
      ) {
        minWorkerVirtualTaskFinishPredictedTimestamp = workerLastVirtualTaskFinishPredictedTimestamp
        chosenWorker = worker
      }
    }
    this.setWorkerLastVirtualTaskFinishTimestamp(
      chosenWorker,
      minWorkerVirtualTaskFinishPredictedTimestamp
    )
    return chosenWorker
  }

  /**
   * Get the worker last virtual task start timestamp.
   *
   * @param worker The worker.
   * @returns The worker last virtual task start timestamp.
   */
  private getWorkerLastVirtualTaskStartTimestamp (worker: Worker): number {
    return Math.max(
      Date.now(),
      this.workerLastVirtualTaskFinishTimestamp.get(worker) ?? 0
    )
  }

  private getWorkerLastVirtualTaskFinishPredictedTimestamp (
    worker: Worker
  ): number {
    const workerVirtualTaskStartTimestamp = this.getWorkerLastVirtualTaskStartTimestamp(
      worker
    )
    const workerAvgRunTime =
      this.pool.workerTasksUsage.get(worker)?.avgRunTime ?? 0
    return workerAvgRunTime + workerVirtualTaskStartTimestamp
  }

  private setWorkerLastVirtualTaskFinishTimestamp (
    worker: Worker,
    lastVirtualTaskFinishTimestamp: number
  ): void {
    this.workerLastVirtualTaskFinishTimestamp.set(
      worker,
      lastVirtualTaskFinishTimestamp
    )
  }
}
