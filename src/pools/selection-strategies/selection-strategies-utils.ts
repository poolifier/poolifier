import type { IPoolInternal } from '../pool-internal'
import type { IPoolWorker } from '../pool-worker'
import { FairShareWorkerChoiceStrategy } from './fair-share-worker-choice-strategy'
import { LessBusyWorkerChoiceStrategy } from './less-busy-worker-choice-strategy'
import { LessUsedWorkerChoiceStrategy } from './less-used-worker-choice-strategy'
import { RoundRobinWorkerChoiceStrategy } from './round-robin-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  WorkerChoiceStrategy
} from './selection-strategies-types'
import { WorkerChoiceStrategies } from './selection-strategies-types'
import { WeightedRoundRobinWorkerChoiceStrategy } from './weighted-round-robin-worker-choice-strategy'

/**
 * Gets the worker choice strategy instance.
 *
 * @param pool - The pool instance.
 * @param workerChoiceStrategy - The worker choice strategy.
 * @returns The worker choice strategy instance.
 */
export function getWorkerChoiceStrategy<
  Worker extends IPoolWorker,
  Data,
  Response
> (
  pool: IPoolInternal<Worker, Data, Response>,
  workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
): IWorkerChoiceStrategy {
  switch (workerChoiceStrategy) {
    case WorkerChoiceStrategies.ROUND_ROBIN:
      return new RoundRobinWorkerChoiceStrategy<Worker, Data, Response>(pool)
    case WorkerChoiceStrategies.LESS_USED:
      return new LessUsedWorkerChoiceStrategy<Worker, Data, Response>(pool)
    case WorkerChoiceStrategies.LESS_BUSY:
      return new LessBusyWorkerChoiceStrategy<Worker, Data, Response>(pool)
    case WorkerChoiceStrategies.FAIR_SHARE:
      return new FairShareWorkerChoiceStrategy<Worker, Data, Response>(pool)
    case WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN:
      return new WeightedRoundRobinWorkerChoiceStrategy<Worker, Data, Response>(
        pool
      )
    default:
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Worker choice strategy '${workerChoiceStrategy}' not found`
      )
  }
}
