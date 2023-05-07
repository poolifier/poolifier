import { cpus } from 'node:os'
import type { IWorker } from '../worker'
import type { IPool } from '../pool'
import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  RequiredStatistics,
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
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: true,
    avgRunTime: true,
    medRunTime: false
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
  private readonly roundWeights: number[]
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
    this.checkOptions(this.opts)
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
    let chosenWorkerNodeKey: number
    const workerWeight =
      this.opts.weights?.[this.currentWorkerNodeId] ?? this.defaultWorkerWeight
    if (workerWeight >= this.roundWeights[this.currentRoundId]) {
      chosenWorkerNodeKey = this.currentWorkerNodeId
      this.currentWorkerNodeId =
        this.currentWorkerNodeId === this.pool.workerNodes.length - 1
          ? 0
          : this.currentWorkerNodeId + 1
      if (this.currentWorkerNodeId === this.pool.workerNodes.length - 1) {
        this.currentRoundId =
          this.currentRoundId === this.roundWeights.length - 1
            ? 0
            : this.currentRoundId + 1
      }
    } else {
      let roundId: number | undefined
      let workerNodeId: number | undefined
      for (
        let round = this.currentRoundId;
        round < this.roundWeights.length;
        round++
      ) {
        for (
          let workerNodeKey = this.currentWorkerNodeId + 1;
          workerNodeKey < this.pool.workerNodes.length;
          workerNodeKey++
        ) {
          const workerWeight =
            this.opts.weights?.[workerNodeKey] ?? this.defaultWorkerWeight
          if (workerWeight >= this.roundWeights[round]) {
            roundId = round
            workerNodeId = workerNodeKey
            break
          }
        }
      }
      this.currentRoundId = roundId ?? 0
      this.currentWorkerNodeId = workerNodeId ?? 0
      chosenWorkerNodeKey = this.currentWorkerNodeId
    }
    return chosenWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.currentWorkerNodeId === workerNodeKey) {
      if (this.pool.workerNodes.length === 0) {
        this.currentWorkerNodeId = 0
      } else {
        this.currentWorkerNodeId =
          this.currentWorkerNodeId > this.pool.workerNodes.length - 1
            ? this.pool.workerNodes.length - 1
            : this.currentWorkerNodeId
      }
    }
    return true
  }

  private computeDefaultWorkerWeight (): number {
    let cpusCycleTimeWeight = 0
    for (const cpu of cpus()) {
      // CPU estimated cycle time
      const numberOfDigits = cpu.speed.toString().length - 1
      const cpuCycleTime = 1 / (cpu.speed / Math.pow(10, numberOfDigits))
      cpusCycleTimeWeight += cpuCycleTime * Math.pow(10, numberOfDigits)
    }
    return Math.round(cpusCycleTimeWeight / cpus().length)
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
