import {
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
} from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the least busy worker.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class LeastBusyWorkerChoiceStrategy<
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
      average: false,
      median: false
    },
    waitTime: {
      aggregate: true,
      average: false,
      median: false
    },
    elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS
  }

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
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
  public choose (): number {
    let minTime = Infinity
    for (const [workerNodeKey, workerNode] of this.pool.workerNodes.entries()) {
      const workerTime =
        workerNode.workerUsage.runTime.aggregate +
        workerNode.workerUsage.waitTime.aggregate
      if (workerTime === 0) {
        this.nextWorkerNodeId = workerNodeKey
        break
      } else if (workerTime < minTime) {
        minTime = workerTime
        this.nextWorkerNodeId = workerNodeKey
      }
    }
    return this.nextWorkerNodeId
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }
}
