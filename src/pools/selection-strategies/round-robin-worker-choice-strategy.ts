import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'

import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.js'
import {
  type IWorkerChoiceStrategy,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'

/**
 * Selects the next worker in a round robin fashion.
 * @template Worker - Type of worker which manages the strategy.
 * @template Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @template Response - Type of execution response. This can only be structured-cloneable data.
 */
export class RoundRobinWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly name: WorkerChoiceStrategy =
    WorkerChoiceStrategies.ROUND_ROBIN

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ) {
    super(pool, opts)
  }

  /** @inheritDoc */
  public choose (workerNodeKeys?: number[]): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    const chosenWorkerNodeKey = this.roundRobinNextWorkerNodeKey(workerNodeKeys)
    if (chosenWorkerNodeKey == null) {
      return undefined
    }
    if (!this.isWorkerNodeReady(chosenWorkerNodeKey)) {
      return undefined
    }
    return this.checkWorkerNodeKey(chosenWorkerNodeKey)
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.pool.workerNodes.length === 0) {
      return this.reset()
    }
    if (
      this.nextWorkerNodeKey != null &&
      this.nextWorkerNodeKey >= workerNodeKey
    ) {
      this.nextWorkerNodeKey =
        (this.nextWorkerNodeKey - 1 + this.pool.workerNodes.length) %
        this.pool.workerNodes.length
      if (this.previousWorkerNodeKey >= workerNodeKey) {
        this.previousWorkerNodeKey = this.nextWorkerNodeKey
      }
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
    workerNodeKeys?: number[]
  ): number | undefined {
    workerNodeKeys = this.checkWorkerNodeKeys(workerNodeKeys)
    if (workerNodeKeys.length === 0) {
      return undefined
    }
    if (workerNodeKeys.length === 1) {
      const workerNodeKey = workerNodeKeys[0]
      this.nextWorkerNodeKey = workerNodeKey
      return this.isWorkerNodeReady(workerNodeKey) ? workerNodeKey : undefined
    }
    const workerNodesCount = this.pool.workerNodes.length
    for (let i = 0; i < workerNodesCount; i++) {
      this.nextWorkerNodeKey = this.getRoundRobinNextWorkerNodeKey()
      if (workerNodeKeys.includes(this.nextWorkerNodeKey)) {
        return this.nextWorkerNodeKey
      }
    }
    return undefined
  }
}
