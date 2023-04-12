import type { IWorker } from '../worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  RequiredStatistics
} from './selection-strategies-types'

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
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export class FairShareWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: true,
    avgRunTime: true,
    medRunTime: false
  }

  /**
   * Worker last virtual task execution timestamp.
   */
  private readonly workerLastVirtualTaskTimestamp: Map<
  number,
  WorkerVirtualTaskTimestamp
  > = new Map<number, WorkerVirtualTaskTimestamp>()

  /** @inheritDoc */
  public reset (): boolean {
    this.workerLastVirtualTaskTimestamp.clear()
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    let minWorkerVirtualTaskEndTimestamp = Infinity
    let chosenWorkerNodeKey!: number
    for (const [index] of this.pool.workerNodes.entries()) {
      this.computeWorkerLastVirtualTaskTimestamp(index)
      const workerLastVirtualTaskEndTimestamp =
        this.workerLastVirtualTaskTimestamp.get(index)?.end ?? 0
      if (
        workerLastVirtualTaskEndTimestamp < minWorkerVirtualTaskEndTimestamp
      ) {
        minWorkerVirtualTaskEndTimestamp = workerLastVirtualTaskEndTimestamp
        chosenWorkerNodeKey = index
      }
    }
    return chosenWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    const deleted = this.workerLastVirtualTaskTimestamp.delete(workerNodeKey)
    for (const [key, value] of this.workerLastVirtualTaskTimestamp.entries()) {
      if (key > workerNodeKey) {
        this.workerLastVirtualTaskTimestamp.set(key - 1, value)
      }
    }
    return deleted
  }

  /**
   * Computes worker last virtual task timestamp.
   *
   * @param workerNodeKey - The worker node key.
   */
  private computeWorkerLastVirtualTaskTimestamp (workerNodeKey: number): void {
    const workerVirtualTaskStartTimestamp = Math.max(
      performance.now(),
      this.workerLastVirtualTaskTimestamp.get(workerNodeKey)?.end ?? -Infinity
    )
    const workerVirtualTaskTRunTime = this.requiredStatistics.medRunTime
      ? this.pool.workerNodes[workerNodeKey].tasksUsage.medRunTime
      : this.pool.workerNodes[workerNodeKey].tasksUsage.avgRunTime
    this.workerLastVirtualTaskTimestamp.set(workerNodeKey, {
      start: workerVirtualTaskStartTimestamp,
      end: workerVirtualTaskStartTimestamp + (workerVirtualTaskTRunTime ?? 0)
    })
  }
}
