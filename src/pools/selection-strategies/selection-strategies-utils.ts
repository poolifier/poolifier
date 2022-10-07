import type { AbstractPoolWorker } from '../abstract-pool-worker'
import type { IPoolInternal } from '../pool-internal'
import { FairShareWorkerChoiceStrategy } from './fair-share-worker-choice-strategy'
import { LessRecentlyUsedWorkerChoiceStrategy } from './less-recently-used-worker-choice-strategy'
import { RoundRobinWorkerChoiceStrategy } from './round-robin-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  WorkerChoiceStrategy
} from './selection-strategies-types'
import { WorkerChoiceStrategies } from './selection-strategies-types'
import { WeightedRoundRobinWorkerChoiceStrategy } from './weighted-round-robin-choice-strategy'

/**
 * Worker selection strategies helpers class.
 */
export class SelectionStrategiesUtils {
  /**
   * Get the worker choice strategy instance.
   *
   * @param pool The pool instance.
   * @param workerChoiceStrategy The worker choice strategy.
   * @returns The worker choice strategy instance.
   */
  public static getWorkerChoiceStrategy<
    Worker extends AbstractPoolWorker,
    Data,
    Response
  > (
    pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ): IWorkerChoiceStrategy<Worker> {
    switch (workerChoiceStrategy) {
      case WorkerChoiceStrategies.ROUND_ROBIN:
        return new RoundRobinWorkerChoiceStrategy(pool)
      case WorkerChoiceStrategies.LESS_RECENTLY_USED:
        return new LessRecentlyUsedWorkerChoiceStrategy(pool)
      case WorkerChoiceStrategies.FAIR_SHARE:
        return new FairShareWorkerChoiceStrategy(pool)
      case WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN:
        return new WeightedRoundRobinWorkerChoiceStrategy(pool)
      default:
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Worker choice strategy '${workerChoiceStrategy}' not found`
        )
    }
  }
}
