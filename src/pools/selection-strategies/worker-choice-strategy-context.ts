import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import type { IPoolInternal } from '../pool-internal'
import type { IWorker } from '../worker'
import { FairShareWorkerChoiceStrategy } from './fair-share-worker-choice-strategy'
import { LessBusyWorkerChoiceStrategy } from './less-busy-worker-choice-strategy'
import { LessUsedWorkerChoiceStrategy } from './less-used-worker-choice-strategy'
import { RoundRobinWorkerChoiceStrategy } from './round-robin-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  RequiredStatistics,
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'
import { WorkerChoiceStrategies } from './selection-strategies-types'
import { WeightedRoundRobinWorkerChoiceStrategy } from './weighted-round-robin-worker-choice-strategy'

/**
 * The worker choice strategy context.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export class WorkerChoiceStrategyContext<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> {
  private readonly workerChoiceStrategies: Map<
  WorkerChoiceStrategy,
  IWorkerChoiceStrategy
  >

  /**
   * Worker choice strategy context constructor.
   *
   * @param pool - The pool instance.
   * @param workerChoiceStrategyType - The worker choice strategy.
   * @param opts - The worker choice strategy options.
   */
  public constructor (
    pool: IPoolInternal<Worker, Data, Response>,
    private workerChoiceStrategyType: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    this.execute.bind(this)
    this.workerChoiceStrategies = new Map<
    WorkerChoiceStrategy,
    IWorkerChoiceStrategy
    >([
      [
        WorkerChoiceStrategies.ROUND_ROBIN,
        new RoundRobinWorkerChoiceStrategy<Worker, Data, Response>(pool, opts)
      ],
      [
        WorkerChoiceStrategies.LESS_USED,
        new LessUsedWorkerChoiceStrategy<Worker, Data, Response>(pool, opts)
      ],
      [
        WorkerChoiceStrategies.LESS_BUSY,
        new LessBusyWorkerChoiceStrategy<Worker, Data, Response>(pool, opts)
      ],
      [
        WorkerChoiceStrategies.FAIR_SHARE,
        new FairShareWorkerChoiceStrategy<Worker, Data, Response>(pool, opts)
      ],
      [
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
        new WeightedRoundRobinWorkerChoiceStrategy<Worker, Data, Response>(
          pool,
          opts
        )
      ]
    ])
  }

  /**
   * Gets the worker choice strategy in the context required statistics.
   *
   * @returns The required statistics.
   */
  public getRequiredStatistics (): RequiredStatistics {
    return (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategyType
      ) as IWorkerChoiceStrategy
    ).requiredStatistics
  }

  /**
   * Sets the worker choice strategy to use in the context.
   *
   * @param workerChoiceStrategy - The worker choice strategy to set.
   */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    if (this.workerChoiceStrategyType !== workerChoiceStrategy) {
      this.workerChoiceStrategyType = workerChoiceStrategy
    }
    this.workerChoiceStrategies.get(this.workerChoiceStrategyType)?.reset()
  }

  /**
   * Executes the worker choice strategy algorithm in the context.
   *
   * @returns The key of the worker node.
   */
  public execute (): number {
    return (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategyType
      ) as IWorkerChoiceStrategy
    ).choose()
  }

  /**
   * Removes a worker node key from the worker choice strategy in the context.
   *
   * @param workerNodeKey - The key of the worker node.
   * @returns `true` if the removal is successful, `false` otherwise.
   */
  public remove (workerNodeKey: number): boolean {
    return (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategyType
      ) as IWorkerChoiceStrategy
    ).remove(workerNodeKey)
  }
}
