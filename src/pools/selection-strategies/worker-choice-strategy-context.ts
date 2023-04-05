import type { IPoolInternal } from '../pool-internal'
import { PoolType } from '../pool-internal'
import type { IPoolWorker } from '../pool-worker'
import type {
  IWorkerChoiceStrategy,
  RequiredStatistics,
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
  private workerChoiceStrategy!: IWorkerChoiceStrategy

  /**
   * Worker choice strategy context constructor.
   *
   * @param pool - The pool instance.
   * @param createWorkerCallback - The worker creation callback for dynamic pool.
   * @param workerChoiceStrategy - The worker choice strategy.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>,
    private readonly createWorkerCallback: () => number,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ) {
    this.execute.bind(this)
    this.setWorkerChoiceStrategy(workerChoiceStrategy)
  }

  /**
   * Gets the worker choice strategy required statistics.
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
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    this.workerChoiceStrategy?.reset()
    this.workerChoiceStrategy = getWorkerChoiceStrategy<Worker, Data, Response>(
      this.pool,
      workerChoiceStrategy
    )
  }

  /**
   * Chooses a worker with the worker choice strategy.
   *
   * @returns The key of the chosen one.
   */
  public execute (): number {
    if (
      this.pool.type === PoolType.DYNAMIC &&
      !this.pool.full &&
      this.pool.findFreeWorkerKey() === -1
    ) {
      return this.createWorkerCallback()
    }
    return this.workerChoiceStrategy.choose()
  }

  /**
   * Removes a worker in the worker choice strategy internals.
   *
   * @param workerKey - The key of the worker to remove.
   * @returns `true` if the removal is successful, `false` otherwise.
   */
  public remove (workerKey: number): boolean {
    return this.workerChoiceStrategy.remove(workerKey)
  }
}
