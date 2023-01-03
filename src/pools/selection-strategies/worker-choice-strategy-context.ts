import type { IPoolInternal } from '../pool-internal'
import { PoolType } from '../pool-internal'
import type { IPoolWorker } from '../pool-worker'
import { DynamicPoolWorkerChoiceStrategy } from './dynamic-pool-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  WorkerChoiceStrategy
} from './selection-strategies-types'
import { WorkerChoiceStrategies } from './selection-strategies-types'
import { getWorkerChoiceStrategy } from './selection-strategies-utils'

/**
 * The worker choice strategy context.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export class WorkerChoiceStrategyContext<
  Worker extends IPoolWorker,
  Data,
  Response
> {
  private workerChoiceStrategy!: IWorkerChoiceStrategy<Worker>

  /**
   * Worker choice strategy context constructor.
   *
   * @param pool - The pool instance.
   * @param createDynamicallyWorkerCallback - The worker creation callback for dynamic pool.
   * @param workerChoiceStrategy - The worker choice strategy.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>,
    private readonly createDynamicallyWorkerCallback: () => Worker,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ) {
    this.setWorkerChoiceStrategy(workerChoiceStrategy)
  }

  /**
   * Gets the worker choice strategy instance specific to the pool type.
   *
   * @param workerChoiceStrategy - The worker choice strategy.
   * @returns The worker choice strategy instance for the pool type.
   */
  private getPoolWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ): IWorkerChoiceStrategy<Worker> {
    if (this.pool.type === PoolType.DYNAMIC) {
      return new DynamicPoolWorkerChoiceStrategy(
        this.pool,
        this.createDynamicallyWorkerCallback,
        workerChoiceStrategy
      )
    }
    return getWorkerChoiceStrategy(this.pool, workerChoiceStrategy)
  }

  /**
   * Gets the worker choice strategy used in the context.
   *
   * @returns The worker choice strategy.
   */
  public getWorkerChoiceStrategy (): IWorkerChoiceStrategy<Worker> {
    return this.workerChoiceStrategy
  }

  /**
   * Sets the worker choice strategy to use in the context.
   *
   * @param workerChoiceStrategy - The worker choice strategy to set.
   */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    this.workerChoiceStrategy?.reset()
    this.workerChoiceStrategy =
      this.getPoolWorkerChoiceStrategy(workerChoiceStrategy)
  }

  /**
   * Chooses a worker with the underlying selection strategy.
   *
   * @returns The chosen one.
   */
  public execute (): Worker {
    return this.workerChoiceStrategy.choose()
  }
}
