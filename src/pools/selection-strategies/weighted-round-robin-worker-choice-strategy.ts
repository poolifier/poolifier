import type { IWorker } from '../worker'
import type { IPool } from '../pool'
import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the next worker with a weighted round robin scheduling algorithm.
 * Loosely modeled after the weighted round robin queueing algorithm: https://en.wikipedia.org/wiki/Weighted_round_robin.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export class WeightedRoundRobinWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements = {
    runTime: {
      aggregate: true,
      average: true,
      median: false
    },
    waitTime: {
      aggregate: false,
      average: false,
      median: false
    },
    elu: {
      aggregate: false,
      average: false,
      median: false
    }
  }

  /**
   * Worker node id where the current task will be submitted.
   */
  private currentWorkerNodeId: number = 0
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
    this.currentWorkerNodeId = 0
    this.workerVirtualTaskRunTime = 0
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    const chosenWorkerNodeKey = this.currentWorkerNodeId
    const workerVirtualTaskRunTime = this.workerVirtualTaskRunTime
    const workerWeight =
      this.opts.weights?.[chosenWorkerNodeKey] ?? this.defaultWorkerWeight
    if (workerVirtualTaskRunTime < workerWeight) {
      this.workerVirtualTaskRunTime =
        workerVirtualTaskRunTime +
        this.getWorkerTaskRunTime(chosenWorkerNodeKey)
    } else {
      this.currentWorkerNodeId =
        this.currentWorkerNodeId === this.pool.workerNodes.length - 1
          ? 0
          : this.currentWorkerNodeId + 1
      this.workerVirtualTaskRunTime = 0
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
      }
      this.workerVirtualTaskRunTime = 0
    }
    return true
  }
}
