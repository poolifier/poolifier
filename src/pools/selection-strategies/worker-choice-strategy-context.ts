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
  private workerChoiceStrategy: IWorkerChoiceStrategy<Worker, Data, Response>

  /**
   * Worker choice strategy context constructor.
   *
   * @param pool - The pool instance.
   * @param createWorkerCallback - The worker creation callback for dynamic pool.
   * @param workerChoiceStrategy - The worker choice strategy.
   */
  public constructor (
    pool: IPoolInternal<Worker, Data, Response>,
    private readonly createWorkerCallback: () => number,
    private workerChoiceStrategyType: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ) {
    this.execute.bind(this)
    this.workerChoiceStrategy = this.getWorkerChoiceStrategy(
      pool,
      this.workerChoiceStrategyType
    )
  }

  /**
   * Gets the worker choice strategy in the context required statistics.
   *
   * @returns The required statistics.
   */
  public getRequiredStatistics (): RequiredStatistics {
    return this.workerChoiceStrategy.requiredStatistics
  }

  /**
   * Sets the worker choice strategy to use in the context.
   *
   * @param workerChoiceStrategy - The worker choice strategy to set.
   */
  public setWorkerChoiceStrategy (
    pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    if (this.workerChoiceStrategyType === workerChoiceStrategy) {
      this.workerChoiceStrategy?.reset()
    } else {
      this.workerChoiceStrategyType = workerChoiceStrategy
      this.workerChoiceStrategy = this.getWorkerChoiceStrategy(
        pool,
        this.workerChoiceStrategyType
      )
    }
  }

  /**
   * Executes the worker choice strategy algorithm in the context.
   *
   * @returns The key of the chosen one.
   */
  public execute (): number {
    if (
      this.workerChoiceStrategy.isDynamicPool &&
      !this.workerChoiceStrategy.pool.full &&
      this.workerChoiceStrategy.pool.findFreeWorkerKey() === -1
    ) {
      return this.createWorkerCallback()
    }
    return this.workerChoiceStrategy.choose()
  }

  /**
   * Removes a worker from the worker choice strategy in the context.
   *
   * @param workerKey - The key of the worker to remove.
   * @returns `true` if the removal is successful, `false` otherwise.
   */
  public remove (workerKey: number): boolean {
    return this.workerChoiceStrategy.remove(workerKey)
  }

  /**
   * Gets the worker choice strategy instance.
   *
   * @param pool - The pool instance.
   * @param workerChoiceStrategy - The worker choice strategy.
   * @returns The worker choice strategy instance.
   */
  private getWorkerChoiceStrategy (
    pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ): IWorkerChoiceStrategy<Worker, Data, Response> {
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
        return new WeightedRoundRobinWorkerChoiceStrategy<
        Worker,
        Data,
        Response
        >(pool)
      default:
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Worker choice strategy '${workerChoiceStrategy}' not found`
        )
    }
  }
}
