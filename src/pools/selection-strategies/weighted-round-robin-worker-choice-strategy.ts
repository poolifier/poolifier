import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'

import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../utils.js'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.js'
import {
  type IWorkerChoiceStrategy,
  type TaskStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'

/**
 * Selects the next worker with a weighted round robin scheduling algorithm.
 * Loosely modeled after the weighted round robin queueing algorithm: https://en.wikipedia.org/wiki/Weighted_round_robin.
 * @template Worker - Type of worker which manages the strategy.
 * @template Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @template Response - Type of execution response. This can only be structured-cloneable data.
 */
export class WeightedRoundRobinWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly name: WorkerChoiceStrategy =
    WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN

  /** @inheritDoc */
  public override readonly taskStatisticsRequirements: TaskStatisticsRequirements =
    Object.freeze({
      elu: { ...DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS },
      runTime: {
        aggregate: true,
        average: true,
        median: false,
      },
      waitTime: {
        aggregate: true,
        average: true,
        median: false,
      },
    })

  /**
   * Worker node virtual execution time.
   */
  private workerNodeVirtualTaskExecutionTime = 0

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
  }

  /** @inheritDoc */
  public choose (workerNodeKeysSet?: ReadonlySet<number>): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    const chosenWorkerNodeKey =
      this.weightedRoundRobinNextWorkerNodeKey(workerNodeKeysSet)
    if (chosenWorkerNodeKey == null) {
      return undefined
    }
    if (!this.isWorkerNodeEligible(chosenWorkerNodeKey, workerNodeKeysSet)) {
      return undefined
    }
    return this.checkWorkerNodeKey(chosenWorkerNodeKey)
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.pool.workerNodes.length === 0) {
      return this.reset()
    }
    if (this.nextWorkerNodeKey === workerNodeKey) {
      this.workerNodeVirtualTaskExecutionTime = 0
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
    this.workerNodeVirtualTaskExecutionTime = 0
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  private findEligibleWorkerNodeKey (
    workerNodeKeysSet: ReadonlySet<number>
  ): number | undefined {
    const workerNodesCount = this.pool.workerNodes.length
    for (let i = 0; i < workerNodesCount; i++) {
      this.nextWorkerNodeKey = this.getRoundRobinNextWorkerNodeKey()
      if (workerNodeKeysSet.has(this.nextWorkerNodeKey)) {
        return this.nextWorkerNodeKey
      }
    }
    return undefined
  }

  private weightedRoundRobinNextWorkerNodeKey (
    workerNodeKeysSet?: ReadonlySet<number>
  ): number | undefined {
    if (workerNodeKeysSet == null) {
      const workerNodeKey = this.nextWorkerNodeKey ?? this.previousWorkerNodeKey
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const workerWeight = this.opts!.weights![workerNodeKey]
      if (this.workerNodeVirtualTaskExecutionTime < workerWeight) {
        this.nextWorkerNodeKey = workerNodeKey
        this.workerNodeVirtualTaskExecutionTime +=
          this.getWorkerNodeTaskWaitTime(workerNodeKey) +
          this.getWorkerNodeTaskRunTime(workerNodeKey)
      } else {
        this.nextWorkerNodeKey = this.getRoundRobinNextWorkerNodeKey()
        this.workerNodeVirtualTaskExecutionTime = 0
      }
      return this.nextWorkerNodeKey
    }
    if (workerNodeKeysSet.size === 0) {
      return undefined
    }
    if (workerNodeKeysSet.size === 1) {
      const [workerNodeKey] = workerNodeKeysSet
      this.nextWorkerNodeKey = workerNodeKey
      this.workerNodeVirtualTaskExecutionTime = 0
      return this.getSingleWorkerNodeKey(workerNodeKeysSet)
    }
    const workerNodeKey = this.nextWorkerNodeKey ?? this.previousWorkerNodeKey
    if (!workerNodeKeysSet.has(workerNodeKey)) {
      this.nextWorkerNodeKey = this.findEligibleWorkerNodeKey(workerNodeKeysSet)
      this.workerNodeVirtualTaskExecutionTime = 0
      return this.nextWorkerNodeKey
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const workerWeight = this.opts!.weights![workerNodeKey]
    if (this.workerNodeVirtualTaskExecutionTime < workerWeight) {
      this.nextWorkerNodeKey = workerNodeKey
      this.workerNodeVirtualTaskExecutionTime +=
        this.getWorkerNodeTaskWaitTime(workerNodeKey) +
        this.getWorkerNodeTaskRunTime(workerNodeKey)
    } else {
      this.nextWorkerNodeKey = this.findEligibleWorkerNodeKey(workerNodeKeysSet)
      this.workerNodeVirtualTaskExecutionTime = 0
    }
    return this.nextWorkerNodeKey
  }
}
