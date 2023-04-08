import type { IPoolInternal } from '../pool-internal'
import type { IPoolWorker } from '../pool-worker'
import { FairShareWorkerChoiceStrategy } from './fair-share-worker-choice-strategy'
import { LessBusyWorkerChoiceStrategy } from './less-busy-worker-choice-strategy'
import { LessUsedWorkerChoiceStrategy } from './less-used-worker-choice-strategy'
import { RoundRobinWorkerChoiceStrategy } from './round-robin-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  RequiredStatistics,
  WorkerChoiceStrategy
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
  Worker extends IPoolWorker,
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
   */
  public constructor (
    pool: IPoolInternal<Worker, Data, Response>,
    private workerChoiceStrategyType: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ) {
    this.execute.bind(this)
    this.workerChoiceStrategies = new Map<
    WorkerChoiceStrategy,
    IWorkerChoiceStrategy
    >([
      [
        WorkerChoiceStrategies.ROUND_ROBIN,
        new RoundRobinWorkerChoiceStrategy<Worker, Data, Response>(pool)
      ],
      [
        WorkerChoiceStrategies.LESS_USED,
        new LessUsedWorkerChoiceStrategy<Worker, Data, Response>(pool)
      ],
      [
        WorkerChoiceStrategies.LESS_BUSY,
        new LessBusyWorkerChoiceStrategy<Worker, Data, Response>(pool)
      ],
      [
        WorkerChoiceStrategies.FAIR_SHARE,
        new FairShareWorkerChoiceStrategy<Worker, Data, Response>(pool)
      ],
      [
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
        new WeightedRoundRobinWorkerChoiceStrategy<Worker, Data, Response>(pool)
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
   * @returns The key of the chosen one.
   */
  public execute (): number {
    return (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategyType
      ) as IWorkerChoiceStrategy
    ).choose()
  }

  /**
   * Removes a worker from the worker choice strategy in the context.
   *
   * @param workerKey - The key of the worker to remove.
   * @returns `true` if the removal is successful, `false` otherwise.
   */
  public remove (workerKey: number): boolean {
    return (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategyType
      ) as IWorkerChoiceStrategy
    ).remove(workerKey)
  }
}
