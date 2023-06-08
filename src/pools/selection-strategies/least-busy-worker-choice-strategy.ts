import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
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
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
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
    runTime: true,
    avgRunTime: false,
    medRunTime: false,
    waitTime: false,
    avgWaitTime: false,
    medWaitTime: false,
    elu: false
  }

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    super(pool, opts)
    this.setTaskStatistics(this.opts)
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
    let minRunTime = Infinity
    let leastBusyWorkerNodeKey!: number
    for (const [workerNodeKey, workerNode] of this.pool.workerNodes.entries()) {
      const workerRunTime = workerNode.workerUsage.runTime.aggregation
      if (workerRunTime === 0) {
        return workerNodeKey
      } else if (workerRunTime < minRunTime) {
        minRunTime = workerRunTime
        leastBusyWorkerNodeKey = workerNodeKey
      }
    }
    return leastBusyWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }
}
