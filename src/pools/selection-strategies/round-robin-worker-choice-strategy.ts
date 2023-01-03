import type { IPoolWorker } from '../pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'

/**
 * Selects the next worker in a round robin fashion.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export class RoundRobinWorkerChoiceStrategy<
  Worker extends IPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  /**
   * Index for the next worker.
   */
  private nextWorkerIndex: number = 0

  /** {@inheritDoc} */
  public reset (): boolean {
    this.nextWorkerIndex = 0
    return true
  }

  /** {@inheritDoc} */
  public choose (): Worker {
    const chosenWorker = this.pool.workers[this.nextWorkerIndex]
    this.nextWorkerIndex =
      this.nextWorkerIndex === this.pool.workers.length - 1
        ? 0
        : this.nextWorkerIndex + 1
    return chosenWorker
  }
}
