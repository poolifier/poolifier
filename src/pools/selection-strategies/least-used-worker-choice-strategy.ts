import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the least used worker.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export class LeastUsedWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
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
    let minNumberOfTasks = Infinity
    for (const [workerNodeKey, workerNode] of this.pool.workerNodes.entries()) {
      const workerTaskStatistics = workerNode.workerUsage.tasks
      const workerTasks =
        workerTaskStatistics.executed +
        workerTaskStatistics.executing +
        workerTaskStatistics.queued
      if (workerTasks === 0) {
        this.nextWorkerNodeId = workerNodeKey
        break
      } else if (workerTasks < minNumberOfTasks) {
        minNumberOfTasks = workerTasks
        this.nextWorkerNodeId = workerNodeKey
      }
    }
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    return this.nextWorkerNodeId
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }
}
