import type { IPoolWorker } from '../pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type { IWorkerChoiceStrategy } from './selection-strategies-types'

/**
 * Selects the next worker in a round robin fashion.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export class RoundRobinWorkerChoiceStrategy<
    Worker extends IPoolWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy<Worker, Data, Response> {
  /**
   * Id of the next worker.
   */
  private nextWorkerId: number = 0

  /** @inheritDoc */
  public reset (): boolean {
    this.nextWorkerId = 0
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    const chosenWorkerKey = this.nextWorkerId
    this.nextWorkerId =
      this.nextWorkerId === this.pool.workers.length - 1
        ? 0
        : this.nextWorkerId + 1
    return chosenWorkerKey
  }

  /** @inheritDoc */
  public remove (workerKey: number): boolean {
    if (this.nextWorkerId === workerKey) {
      if (this.pool.workers.length === 0) {
        this.nextWorkerId = 0
      } else {
        this.nextWorkerId =
          this.nextWorkerId > this.pool.workers.length - 1
            ? this.pool.workers.length - 1
            : this.nextWorkerId
      }
    }
    return true
  }
}
