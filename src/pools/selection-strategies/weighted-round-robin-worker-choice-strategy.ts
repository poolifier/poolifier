import type { IWorker } from '../worker.js'
import type { IPool } from '../pool.js'
import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../../utils.js'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.js'
import type {
  IWorkerChoiceStrategy,
  InternalWorkerChoiceStrategyOptions,
  TaskStatisticsRequirements
} from './selection-strategies-types.js'

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
   * Worker node virtual task runtime.
   */
  private workerNodeVirtualTaskRunTime: number = 0

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: InternalWorkerChoiceStrategyOptions
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
  }

  /** @inheritDoc */
  public reset (): boolean {
    this.resetWorkerNodeKeyProperties()
    this.workerNodeVirtualTaskRunTime = 0
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  /** @inheritDoc */
  public choose (): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.weightedRoundRobinNextWorkerNodeKey()
    this.checkNextWorkerNodeReadiness()
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.pool.workerNodes.length === 0) {
      this.reset()
    }
    if (this.nextWorkerNodeKey === workerNodeKey) {
      this.workerNodeVirtualTaskRunTime = 0
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

  private weightedRoundRobinNextWorkerNodeKey (): number | undefined {
    const workerWeight = this.opts.weights?.[
      this.nextWorkerNodeKey ?? this.previousWorkerNodeKey
    ] as number
    if (this.workerNodeVirtualTaskRunTime < workerWeight) {
      this.workerNodeVirtualTaskRunTime =
        this.workerNodeVirtualTaskRunTime +
        this.getWorkerNodeTaskRunTime(
          this.nextWorkerNodeKey ?? this.previousWorkerNodeKey
        )
    } else {
      this.nextWorkerNodeKey =
        this.nextWorkerNodeKey === this.pool.workerNodes.length - 1
          ? 0
          : (this.nextWorkerNodeKey ?? this.previousWorkerNodeKey) + 1
      this.workerNodeVirtualTaskRunTime = 0
    }
    return this.nextWorkerNodeKey
  }
}
