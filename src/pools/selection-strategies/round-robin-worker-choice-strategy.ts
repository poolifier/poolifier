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
    this.roundRobinNextWorkerNodeKey(workerNodeKeys)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!this.isWorkerNodeReady(this.nextWorkerNodeKey!)) {
      return undefined
    }
    return this.checkWorkerNodeKey(this.nextWorkerNodeKey)
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
    if (workerNodeKeys.length === 1) {
      return workerNodeKeys[0]
    }
    do {
      this.nextWorkerNodeKey = this.getRoundRobinNextWorkerNodeKey()
    } while (!workerNodeKeys.includes(this.nextWorkerNodeKey))
    return this.nextWorkerNodeKey
  }
}
