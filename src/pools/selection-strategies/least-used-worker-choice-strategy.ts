import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.js'
import type {
  IWorkerChoiceStrategy,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types.js'

/**
 * Selects the least used worker.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class LeastUsedWorkerChoiceStrategy<
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
  public reset (): boolean {
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  /** @inheritDoc */
  public choose (affinity?: number[]): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.nextWorkerNodeKey = this.leastUsedNextWorkerNodeKey(affinity)
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }

  private leastUsedNextWorkerNodeKey (affinity?: number[]): number | undefined {
    affinity = this.checkAffinity(affinity)
    if (affinity.length === 1) {
      return affinity[0]
    }
    return this.pool.workerNodes.reduce(
      (minWorkerNodeKey, workerNode, workerNodeKey, workerNodes) => {
        return this.isWorkerNodeReady(workerNodeKey) &&
          affinity.includes(workerNodeKey) &&
          workerNode.usage.tasks.executing + workerNode.usage.tasks.queued <
            workerNodes[minWorkerNodeKey].usage.tasks.executing +
              workerNodes[minWorkerNodeKey].usage.tasks.queued
          ? workerNodeKey
          : minWorkerNodeKey
      },
      0
    )
  }
}
