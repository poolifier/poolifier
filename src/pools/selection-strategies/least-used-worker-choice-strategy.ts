import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the least used worker.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class LeastUsedWorkerChoiceStrategy<
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
  public choose (): number | undefined {
    const chosenWorkerNodeKey = this.leastUsedNextWorkerNodeKey()
    this.assignChosenWorkerNodeKey(chosenWorkerNodeKey)
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }

  private leastUsedNextWorkerNodeKey (): number | undefined {
    let minNumberOfTasks = Infinity
    let chosenWorkerNodeKey: number | undefined
    for (const [workerNodeKey, workerNode] of this.pool.workerNodes.entries()) {
      const workerTaskStatistics = workerNode.usage.tasks
      const workerTasks =
        workerTaskStatistics.executed +
        workerTaskStatistics.executing +
        workerTaskStatistics.queued
      if (this.isWorkerNodeEligible(workerNodeKey) && workerTasks === 0) {
        chosenWorkerNodeKey = workerNodeKey
        break
      } else if (
        this.isWorkerNodeEligible(workerNodeKey) &&
        workerTasks < minNumberOfTasks
      ) {
        minNumberOfTasks = workerTasks
        chosenWorkerNodeKey = workerNodeKey
      }
    }
    return chosenWorkerNodeKey
  }
}
