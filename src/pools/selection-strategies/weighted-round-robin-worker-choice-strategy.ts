import type { IWorker } from '../worker'
import type { IPool } from '../pool'
import {
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
} from '../../utils'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the next worker with a weighted round robin scheduling algorithm.
 * Loosely modeled after the weighted round robin queueing algorithm: https://en.wikipedia.org/wiki/Weighted_round_robin.
 *
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
  public readonly strategyPolicy: StrategyPolicy = {
    useDynamicWorker: true
  }

  /** @inheritDoc */
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements = {
    runTime: {
      aggregate: true,
      average: true,
      median: false
    },
    waitTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS
  }

  /**
   * Default worker weight.
   */
  private readonly defaultWorkerWeight: number
  /**
   * Worker virtual task runtime.
   */
  private workerVirtualTaskRunTime: number = 0

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
    this.defaultWorkerWeight = this.computeDefaultWorkerWeight()
  }

  /** @inheritDoc */
  public reset (): boolean {
    this.nextWorkerNodeKey = 0
    this.workerVirtualTaskRunTime = 0
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    const chosenWorkerNodeKey = this.nextWorkerNodeKey
    this.weightedRoundRobinNextWorkerNodeKey()
    return chosenWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.nextWorkerNodeKey === workerNodeKey) {
      if (this.pool.workerNodes.length === 0) {
        this.nextWorkerNodeKey = 0
      } else if (this.nextWorkerNodeKey > this.pool.workerNodes.length - 1) {
        this.nextWorkerNodeKey = this.pool.workerNodes.length - 1
      }
      this.workerVirtualTaskRunTime = 0
    }
    return true
  }

  private weightedRoundRobinNextWorkerNodeKey (): number {
    const workerVirtualTaskRunTime = this.workerVirtualTaskRunTime
    const workerWeight =
      this.opts.weights?.[this.nextWorkerNodeKey] ?? this.defaultWorkerWeight
    if (workerVirtualTaskRunTime < workerWeight) {
      this.workerVirtualTaskRunTime =
        workerVirtualTaskRunTime +
        this.getWorkerTaskRunTime(this.nextWorkerNodeKey)
    } else {
      this.nextWorkerNodeKey =
        this.nextWorkerNodeKey === this.pool.workerNodes.length - 1
          ? 0
          : this.nextWorkerNodeKey + 1
      this.workerVirtualTaskRunTime = 0
    }
    return this.nextWorkerNodeKey
  }
}
