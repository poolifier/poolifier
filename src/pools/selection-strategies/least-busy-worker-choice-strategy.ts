import {
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
} from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
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
  public readonly strategyPolicy: StrategyPolicy = {
    dynamicWorkerUsage: false,
    dynamicWorkerReady: true
  }

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
  public choose (): number | undefined {
    const chosenWorkerNodeKey = this.leastBusyNextWorkerNodeKey()
    this.assignChosenWorkerNodeKey(chosenWorkerNodeKey)
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }

  private leastBusyNextWorkerNodeKey (): number | undefined {
    let minTime = Infinity
    let chosenWorkerNodeKey: number | undefined
    for (const [workerNodeKey, workerNode] of this.pool.workerNodes.entries()) {
      const workerTime =
        (workerNode.usage.runTime?.aggregate ?? 0) +
        (workerNode.usage.waitTime?.aggregate ?? 0)
      if (this.isWorkerNodeEligible(workerNodeKey) && workerTime === 0) {
        chosenWorkerNodeKey = workerNodeKey
        break
      } else if (
        this.isWorkerNodeEligible(workerNodeKey) &&
        workerTime < minTime
      ) {
        minTime = workerTime
        chosenWorkerNodeKey = workerNodeKey
      }
    }
    return chosenWorkerNodeKey
  }
}
