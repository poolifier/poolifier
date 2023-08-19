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
 * Selects the worker with the least ELU.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class LeastEluWorkerChoiceStrategy<
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
    runTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    waitTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    elu: {
      aggregate: true,
      average: false,
      median: false
    }
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
    const chosenWorkerNodeKey = this.leastEluNextWorkerNodeKey()
    this.assignChosenWorkerNodeKey(chosenWorkerNodeKey)
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }

  private leastEluNextWorkerNodeKey (): number | undefined {
    let minWorkerElu = Infinity
    let chosenWorkerNodeKey: number | undefined
    for (const [workerNodeKey, workerNode] of this.pool.workerNodes.entries()) {
      const workerUsage = workerNode.usage
      const workerElu = workerUsage.elu?.active?.aggregate ?? 0
      if (this.isWorkerNodeEligible(workerNodeKey) && workerElu === 0) {
        chosenWorkerNodeKey = workerNodeKey
        break
      } else if (
        this.isWorkerNodeEligible(workerNodeKey) &&
        workerElu < minWorkerElu
      ) {
        minWorkerElu = workerElu
        chosenWorkerNodeKey = workerNodeKey
      }
    }
    return chosenWorkerNodeKey
  }
}
