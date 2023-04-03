import type { IPoolWorker } from '../pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type { RequiredStatistics } from './selection-strategies-types'

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
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export class FairShareWorkerChoiceStrategy<
  Worker extends IPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  /** {@inheritDoc} */
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: true
  }

  /**
   *  Worker last virtual task execution timestamp.
   */
  private readonly workerLastVirtualTaskTimestamp: Map<
  number,
  WorkerVirtualTaskTimestamp
  > = new Map<number, WorkerVirtualTaskTimestamp>()

  /** {@inheritDoc} */
  public reset (): boolean {
    this.workerLastVirtualTaskTimestamp.clear()
    return true
  }

  /** {@inheritDoc} */
  public choose (): number {
    let minWorkerVirtualTaskEndTimestamp = Infinity
    let chosenWorkerKey!: number
    for (const [index] of this.pool.workers.entries()) {
      this.computeWorkerLastVirtualTaskTimestamp(index)
      const workerLastVirtualTaskEndTimestamp =
        this.workerLastVirtualTaskTimestamp.get(index)?.end ?? 0
      if (
        workerLastVirtualTaskEndTimestamp < minWorkerVirtualTaskEndTimestamp
      ) {
        minWorkerVirtualTaskEndTimestamp = workerLastVirtualTaskEndTimestamp
        chosenWorkerKey = index
      }
    }
    return chosenWorkerKey
  }

  /** {@inheritDoc} */
  public remove (workerKey: number): boolean {
    const workerDeleted = this.workerLastVirtualTaskTimestamp.delete(workerKey)
    for (const [key, value] of this.workerLastVirtualTaskTimestamp.entries()) {
      if (key > workerKey) {
        this.workerLastVirtualTaskTimestamp.set(key - 1, value)
      }
    }
    return workerDeleted
  }

  /**
   * Computes worker last virtual task timestamp.
   *
   * @param workerKey - The worker key.
   */
  private computeWorkerLastVirtualTaskTimestamp (workerKey: number): void {
    const workerVirtualTaskStartTimestamp = Math.max(
      Date.now(),
      this.workerLastVirtualTaskTimestamp.get(workerKey)?.end ?? -Infinity
    )
    this.workerLastVirtualTaskTimestamp.set(workerKey, {
      start: workerVirtualTaskStartTimestamp,
      end:
        workerVirtualTaskStartTimestamp +
        (this.pool.workers[workerKey].tasksUsage.avgRunTime ?? 0)
    })
  }
}
