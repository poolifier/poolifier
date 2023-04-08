import type { IWorker } from '../worker'
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
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /**
   * Id of the next worker node.
   */
  private nextWorkerNodeId: number = 0

  /** @inheritDoc */
  public reset (): boolean {
    this.nextWorkerNodeId = 0
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    const chosenWorkerNodeKey = this.nextWorkerNodeId
    this.nextWorkerNodeId =
      this.nextWorkerNodeId === this.pool.workerNodes.length - 1
        ? 0
        : this.nextWorkerNodeId + 1
    return chosenWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.nextWorkerNodeId === workerNodeKey) {
      if (this.pool.workerNodes.length === 0) {
        this.nextWorkerNodeId = 0
      } else {
        this.nextWorkerNodeId =
          this.nextWorkerNodeId > this.pool.workerNodes.length - 1
            ? this.pool.workerNodes.length - 1
            : this.nextWorkerNodeId
      }
    }
    return true
  }
}
