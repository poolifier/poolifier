import type { AbstractPoolWorker } from '../abstract-pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'

/**
 * Worker virtual task timestamp.
 */
interface WorkerVirtualTaskTimestamp {
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
  Worker extends AbstractPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  /**
   *  Worker last virtual task execution timestamp.
   */
  private workerLastVirtualTaskTimestamp: Map<
    Worker,
    WorkerVirtualTaskTimestamp
  > = new Map<Worker, WorkerVirtualTaskTimestamp>()

  /** @inheritdoc */
  public choose (): Worker {
    this.updateWorkerLastVirtualTaskTimestamp()
    let minWorkerVirtualTaskEndTimestamp = Infinity
    let chosenWorker!: Worker
    for (const worker of this.pool.workers) {
      const workerLastVirtualTaskEndTimestamp =
        this.workerLastVirtualTaskTimestamp.get(worker)?.end ?? 0
      // console.log(worker.id)
      // console.log(workerLastVirtualTaskEndTimestamp)
      // console.log(minWorkerVirtualTaskEndTimestamp)
      if (
        workerLastVirtualTaskEndTimestamp < minWorkerVirtualTaskEndTimestamp
      ) {
        minWorkerVirtualTaskEndTimestamp = workerLastVirtualTaskEndTimestamp
        chosenWorker = worker
      }
    }
    // console.log(chosenWorker.id)
    return chosenWorker
  }

  /**
   * Compute workers last virtual task timestamp.
   */
  private updateWorkerLastVirtualTaskTimestamp () {
    for (const worker of this.pool.workers) {
      const workerVirtualTaskStartTimestamp = Math.max(
        Date.now(),
        this.workerLastVirtualTaskTimestamp.get(worker)?.end ?? 0
      )
      const workerVirtualTaskEndTimestamp =
        workerVirtualTaskStartTimestamp +
        this.pool.getWorkerAverageTasksRunTime(worker)
      this.workerLastVirtualTaskTimestamp.set(worker, {
        start: workerVirtualTaskStartTimestamp,
        end: workerVirtualTaskEndTimestamp
      })
    }
  }
}
