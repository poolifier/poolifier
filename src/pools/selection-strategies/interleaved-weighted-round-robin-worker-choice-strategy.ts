import type { IWorker } from '../worker'
import type { IPool } from '../pool'
import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the next worker with an interleaved weighted round robin scheduling algorithm.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class InterleavedWeightedRoundRobinWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly strategyPolicy: StrategyPolicy = {
    dynamicWorkerUsage: false,
    dynamicWorkerReady: true
  }

  /**
   * Round id.
   * This is used to determine the current round weight.
   */
  private roundId: number = 0
  /**
   * Round weights.
   */
  private roundWeights: number[]
  /**
   * Default worker weight.
   */
  private readonly defaultWorkerWeight: number

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
    this.defaultWorkerWeight = this.computeDefaultWorkerWeight()
    this.roundWeights = this.getRoundWeights()
  }

  /** @inheritDoc */
  public reset (): boolean {
    this.nextWorkerNodeKey = 0
    this.roundId = 0
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  /** @inheritDoc */
  public choose (): number | undefined {
    let roundId: number = this.roundId
    let workerNodeId: number | undefined
    for (
      let roundIndex = this.roundId;
      roundIndex < this.roundWeights.length;
      roundIndex++
    ) {
      roundId = roundIndex
      for (
        let workerNodeKey =
          this.nextWorkerNodeKey ?? this.previousWorkerNodeKey;
        workerNodeKey < this.pool.workerNodes.length;
        workerNodeKey++
      ) {
        const workerWeight =
          this.opts.weights?.[workerNodeKey] ?? this.defaultWorkerWeight
        if (
          this.isWorkerNodeEligible(workerNodeKey) &&
          workerWeight >= this.roundWeights[roundIndex]
        ) {
          workerNodeId = workerNodeKey
          break
        }
      }
    }
    this.roundId = roundId
    if (workerNodeId == null) {
      this.previousWorkerNodeKey =
        this.nextWorkerNodeKey ?? this.previousWorkerNodeKey
    }
    this.nextWorkerNodeKey = workerNodeId
    const chosenWorkerNodeKey = this.nextWorkerNodeKey
    if (this.nextWorkerNodeKey === this.pool.workerNodes.length - 1) {
      this.nextWorkerNodeKey = 0
      this.roundId =
        this.roundId === this.roundWeights.length - 1 ? 0 : this.roundId + 1
    } else {
      this.nextWorkerNodeKey =
        (this.nextWorkerNodeKey ?? this.previousWorkerNodeKey) + 1
    }
    return chosenWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.nextWorkerNodeKey === workerNodeKey) {
      if (this.pool.workerNodes.length === 0) {
        this.nextWorkerNodeKey = 0
      } else if (this.nextWorkerNodeKey > this.pool.workerNodes.length - 1) {
        this.nextWorkerNodeKey = this.pool.workerNodes.length - 1
        this.roundId =
          this.roundId === this.roundWeights.length - 1 ? 0 : this.roundId + 1
      }
    }
    return true
  }

  /** @inheritDoc */
  public setOptions (opts: WorkerChoiceStrategyOptions): void {
    super.setOptions(opts)
    this.roundWeights = this.getRoundWeights()
  }

  private getRoundWeights (): number[] {
    if (this.opts.weights == null) {
      return [this.defaultWorkerWeight]
    }
    return [
      ...new Set(
        Object.values(this.opts.weights)
          .slice()
          .sort((a, b) => a - b)
      )
    ]
  }
}
