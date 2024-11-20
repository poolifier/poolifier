import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import type {
  IWorkerChoiceStrategy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'

import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../utils.js'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.js'

/**
 * Selects the next worker with a weighted round robin scheduling algorithm.
 * Loosely modeled after the weighted round robin queueing algorithm: https://en.wikipedia.org/wiki/Weighted_round_robin.
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class WeightedRoundRobinWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public override readonly taskStatisticsRequirements: TaskStatisticsRequirements =
    {
      elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
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
    }

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
  public choose (workerNodes?: number[]): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.weightedRoundRobinNextWorkerNodeKey(workerNodes)
    this.checkNextWorkerNodeKey()
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.pool.workerNodes.length === 0) {
      this.reset()
      return true
    }
    if (this.nextWorkerNodeKey === workerNodeKey) {
      this.workerNodeVirtualTaskExecutionTime = 0
      if (this.nextWorkerNodeKey > this.pool.workerNodes.length - 1) {
        this.nextWorkerNodeKey = this.pool.workerNodes.length - 1
      }
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
    this.workerNodeVirtualTaskExecutionTime = 0
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  private weightedRoundRobinNextWorkerNodeKey (
    workerNodes?: number[]
  ): number | undefined {
    workerNodes = this.checkWorkerNodes(workerNodes)
    const workerWeight =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.opts!.weights![this.nextWorkerNodeKey ?? this.previousWorkerNodeKey]
    if (this.workerNodeVirtualTaskExecutionTime < workerWeight) {
      this.workerNodeVirtualTaskExecutionTime +=
        this.getWorkerNodeTaskWaitTime(
          this.nextWorkerNodeKey ?? this.previousWorkerNodeKey
        ) +
        this.getWorkerNodeTaskRunTime(
          this.nextWorkerNodeKey ?? this.previousWorkerNodeKey
        )
    } else {
      do {
        this.nextWorkerNodeKey = this.getRoundRobinNextWorkerNodeKey()
      } while (!workerNodes.includes(this.nextWorkerNodeKey))
      this.workerNodeVirtualTaskExecutionTime = 0
    }
    return this.nextWorkerNodeKey
  }
}
