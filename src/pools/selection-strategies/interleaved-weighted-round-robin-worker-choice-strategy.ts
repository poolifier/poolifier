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
 * Selects the next worker with an interleaved weighted round robin scheduling algorithm.
 * @template Worker - Type of worker which manages the strategy.
 * @template Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @template Response - Type of execution response. This can only be structured-cloneable data.
 */
export class InterleavedWeightedRoundRobinWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly name: WorkerChoiceStrategy =
    WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN

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
   * Round id.
   */
  private roundId = 0
  /**
   * Round weights.
   */
  private roundWeights: number[]
  /**
   * Worker node id.
   */
  private workerNodeId = 0
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
    this.roundWeights = this.getRoundWeights()
  }

  /** @inheritDoc */
  public choose (workerNodeKeys?: number[]): number | undefined {
    workerNodeKeys = this.checkWorkerNodeKeys(workerNodeKeys)
    if (workerNodeKeys.length === 1) {
      const workerNodeKey = workerNodeKeys[0]
      return this.isWorkerNodeReady(workerNodeKey) ? workerNodeKey : undefined
    }
    for (
      let roundIndex = this.roundId;
      roundIndex < this.roundWeights.length;
      roundIndex++
    ) {
      this.roundId = roundIndex
      for (
        let workerNodeKey = this.workerNodeId;
        workerNodeKey < this.pool.workerNodes.length;
        workerNodeKey++
      ) {
        this.workerNodeId = workerNodeKey
        if (
          this.workerNodeId !== this.nextWorkerNodeKey &&
          this.workerNodeVirtualTaskExecutionTime !== 0
        ) {
          this.workerNodeVirtualTaskExecutionTime = 0
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const workerWeight = this.opts!.weights![workerNodeKey]
        if (
          this.isWorkerNodeReady(workerNodeKey) &&
          workerNodeKeys.includes(workerNodeKey) &&
          workerWeight >= this.roundWeights[roundIndex] &&
          this.workerNodeVirtualTaskExecutionTime < workerWeight
        ) {
          this.workerNodeVirtualTaskExecutionTime +=
            this.getWorkerNodeTaskWaitTime(workerNodeKey) +
            this.getWorkerNodeTaskRunTime(workerNodeKey)
          this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
          this.nextWorkerNodeKey = workerNodeKey
          return this.nextWorkerNodeKey
        }
      }
    }
    this.interleavedWeightedRoundRobinNextWorkerNodeId()
    return undefined
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.pool.workerNodes.length === 0) {
      this.resetWorkerNodeKeyProperties()
      this.workerNodeId = 0
      this.workerNodeVirtualTaskExecutionTime = 0
      return true
    }
    if (
      this.nextWorkerNodeKey != null &&
      this.nextWorkerNodeKey >= workerNodeKey
    ) {
      this.nextWorkerNodeKey =
        (this.nextWorkerNodeKey - 1 + this.pool.workerNodes.length) %
        this.pool.workerNodes.length
    }
    if (this.workerNodeId >= workerNodeKey) {
      this.workerNodeId =
        (this.workerNodeId - 1 + this.pool.workerNodes.length) %
        this.pool.workerNodes.length
    }
    return true
  }

  /** @inheritDoc */
  public reset (): boolean {
    this.resetWorkerNodeKeyProperties()
    this.roundId = 0
    this.workerNodeId = 0
    this.workerNodeVirtualTaskExecutionTime = 0
    return true
  }

  /** @inheritDoc */
  public override setOptions (
    opts: undefined | WorkerChoiceStrategyOptions
  ): void {
    super.setOptions(opts)
    this.roundWeights = this.getRoundWeights()
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  private getRoundWeights (): number[] {
    return [
      ...new Set(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        Object.values(this.opts!.weights!)
          .slice()
          .sort((a, b) => a - b)
      ),
    ]
  }

  private interleavedWeightedRoundRobinNextWorkerNodeId (): void {
    if (this.pool.workerNodes.length === 0) {
      this.workerNodeId = 0
    } else if (
      this.roundId === this.roundWeights.length - 1 &&
      this.workerNodeId === this.pool.workerNodes.length - 1
    ) {
      this.roundId = 0
      this.workerNodeId = 0
    } else if (this.workerNodeId === this.pool.workerNodes.length - 1) {
      this.roundId = this.roundId + 1
      this.workerNodeId = 0
    } else {
      this.workerNodeId = this.workerNodeId + 1
    }
  }
}
