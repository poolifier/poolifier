import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import type {
  IWorkerChoiceStrategy,
  WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'

import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.js'

/**
 * Selects the next worker in a round robin fashion.
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class RoundRobinWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ) {
    super(pool, opts)
  }

  /** @inheritDoc */
  public choose (workerNodes?: number[]): number | undefined {
    const chosenWorkerNodeKey = this.nextWorkerNodeKey
    this.setPreviousWorkerNodeKey(chosenWorkerNodeKey)
    this.roundRobinNextWorkerNodeKey(workerNodes)
    this.checkNextWorkerNodeKey()
    return chosenWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.pool.workerNodes.length === 0) {
      this.reset()
      return true
    }
    if (
      this.nextWorkerNodeKey === workerNodeKey &&
      this.nextWorkerNodeKey > this.pool.workerNodes.length - 1
    ) {
      this.nextWorkerNodeKey = this.pool.workerNodes.length - 1
    }
    if (
      this.previousWorkerNodeKey === workerNodeKey &&
      this.previousWorkerNodeKey > this.pool.workerNodes.length - 1
    ) {
      this.previousWorkerNodeKey = this.pool.workerNodes.length - 1
    }
    return true
  }

  /** @inheritDoc */
  public reset (): boolean {
    this.resetWorkerNodeKeyProperties()
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  private roundRobinNextWorkerNodeKey (
    workerNodes?: number[]
  ): number | undefined {
    workerNodes = this.checkWorkerNodes(workerNodes)
    if (workerNodes.length === 1) {
      return workerNodes[0]
    }
    do {
      this.nextWorkerNodeKey = this.getRoundRobinNextWorkerNodeKey()
    } while (!workerNodes.includes(this.nextWorkerNodeKey))
    return this.nextWorkerNodeKey
  }
}
