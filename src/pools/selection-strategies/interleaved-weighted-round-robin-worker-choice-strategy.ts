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
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
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
    useDynamicWorker: true
  }

  /**
   * Worker node id where the current task will be submitted.
   */
  private currentWorkerNodeId: number = 0
  /**
   * Current round id.
   * This is used to determine the current round weight.
   */
  private currentRoundId: number = 0
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
    this.currentWorkerNodeId = 0
    this.currentRoundId = 0
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    let roundId: number | undefined
    let workerNodeId: number | undefined
    for (
      let roundIndex = this.currentRoundId;
      roundIndex < this.roundWeights.length;
      roundIndex++
    ) {
      for (
        let workerNodeKey = this.currentWorkerNodeId;
        workerNodeKey < this.pool.workerNodes.length;
        workerNodeKey++
      ) {
        const workerWeight =
          this.opts.weights?.[workerNodeKey] ?? this.defaultWorkerWeight
        if (workerWeight >= this.roundWeights[roundIndex]) {
          roundId = roundIndex
          workerNodeId = workerNodeKey
          break
        }
      }
    }
    this.currentRoundId = roundId ?? 0
    this.currentWorkerNodeId = workerNodeId ?? 0
    const chosenWorkerNodeKey = this.currentWorkerNodeId
    if (this.currentWorkerNodeId === this.pool.workerNodes.length - 1) {
      this.currentWorkerNodeId = 0
      this.currentRoundId =
        this.currentRoundId === this.roundWeights.length - 1
          ? 0
          : this.currentRoundId + 1
    } else {
      this.currentWorkerNodeId = this.currentWorkerNodeId + 1
    }
    return chosenWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.currentWorkerNodeId === workerNodeKey) {
      if (this.pool.workerNodes.length === 0) {
        this.currentWorkerNodeId = 0
      } else if (this.currentWorkerNodeId > this.pool.workerNodes.length - 1) {
        this.currentWorkerNodeId = this.pool.workerNodes.length - 1
        this.currentRoundId =
          this.currentRoundId === this.roundWeights.length - 1
            ? 0
            : this.currentRoundId + 1
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
