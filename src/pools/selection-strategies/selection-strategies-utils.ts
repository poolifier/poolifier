import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import type { WorkerChoiceStrategiesContext } from './worker-choice-strategies-context.js'

import { FairShareWorkerChoiceStrategy } from './fair-share-worker-choice-strategy.js'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from './interleaved-weighted-round-robin-worker-choice-strategy.js'
import { LeastBusyWorkerChoiceStrategy } from './least-busy-worker-choice-strategy.js'
import { LeastEluWorkerChoiceStrategy } from './least-elu-worker-choice-strategy.js'
import { LeastUsedWorkerChoiceStrategy } from './least-used-worker-choice-strategy.js'
import { RoundRobinWorkerChoiceStrategy } from './round-robin-worker-choice-strategy.js'
import {
  type IWorkerChoiceStrategy,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'
import { WeightedRoundRobinWorkerChoiceStrategy } from './weighted-round-robin-worker-choice-strategy.js'

export const getWorkerChoiceStrategy = <Worker extends IWorker, Data, Response>(
  workerChoiceStrategy: WorkerChoiceStrategy,
  pool: IPool<Worker, Data, Response>,
  context: ThisType<WorkerChoiceStrategiesContext<Worker, Data, Response>>,
  opts?: WorkerChoiceStrategyOptions
): IWorkerChoiceStrategy => {
  switch (workerChoiceStrategy) {
    case WorkerChoiceStrategies.FAIR_SHARE:
      return new (FairShareWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN:
      return new (InterleavedWeightedRoundRobinWorkerChoiceStrategy.bind(
        context
      ))(pool, opts)
    case WorkerChoiceStrategies.LEAST_BUSY:
      return new (LeastBusyWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.LEAST_ELU:
      return new (LeastEluWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.LEAST_USED:
      return new (LeastUsedWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.ROUND_ROBIN:
      return new (RoundRobinWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN:
      return new (WeightedRoundRobinWorkerChoiceStrategy.bind(context))(
        pool,
        opts
      )
    default:
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Worker choice strategy '${workerChoiceStrategy}' is not valid`
      )
  }
}
