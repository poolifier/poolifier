import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'
import { WorkerChoiceStrategies } from './selection-strategies-types.js'
import {
  buildWorkerChoiceStrategiesPolicy,
  buildWorkerChoiceStrategiesTaskStatisticsRequirements,
  getWorkerChoiceStrategiesRetries,
  getWorkerChoiceStrategy,
} from './selection-strategies-utils.js'

/**
 * The worker choice strategies context.
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class WorkerChoiceStrategiesContext<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> {
  /**
   * The number of worker choice strategies execution retries.
   */
  public retriesCount: number

  /**
   * The default worker choice strategy in the context.
   */
  private defaultWorkerChoiceStrategy: WorkerChoiceStrategy

  /**
   * The worker choice strategies registered in the context.
   */
  private readonly workerChoiceStrategies: Map<
    WorkerChoiceStrategy,
    IWorkerChoiceStrategy
  >

  /**
   * The active worker choice strategies in the context policy.
   */
  private workerChoiceStrategiesPolicy: StrategyPolicy

  /**
   * The active worker choice strategies in the context task statistics requirements.
   */
  private workerChoiceStrategiesTaskStatisticsRequirements: TaskStatisticsRequirements

  /**
   * The maximum number of worker choice strategies execution retries.
   */
  private readonly retries: number

  /**
   * Worker choice strategies context constructor.
   * @param pool - The pool instance.
   * @param workerChoiceStrategies - The worker choice strategies. @defaultValue [WorkerChoiceStrategies.ROUND_ROBIN]
   * @param opts - The worker choice strategy options.
   */
  public constructor (
    private readonly pool: IPool<Worker, Data, Response>,
    workerChoiceStrategies: WorkerChoiceStrategy[] = [
      WorkerChoiceStrategies.ROUND_ROBIN,
    ],
    opts?: WorkerChoiceStrategyOptions
  ) {
    this.execute = this.execute.bind(this)
    this.defaultWorkerChoiceStrategy = workerChoiceStrategies[0]
    this.workerChoiceStrategies = new Map<
      WorkerChoiceStrategy,
      IWorkerChoiceStrategy
    >()
    for (const workerChoiceStrategy of workerChoiceStrategies) {
      this.addWorkerChoiceStrategy(workerChoiceStrategy, this.pool, opts)
    }
    this.workerChoiceStrategiesPolicy = buildWorkerChoiceStrategiesPolicy(
      this.workerChoiceStrategies
    )
    this.workerChoiceStrategiesTaskStatisticsRequirements =
      buildWorkerChoiceStrategiesTaskStatisticsRequirements(
        this.workerChoiceStrategies
      )
    this.retriesCount = 0
    this.retries = getWorkerChoiceStrategiesRetries<Worker, Data, Response>(
      this.pool,
      opts
    )
  }

  /**
   * Gets the active worker choice strategies in the context policy.
   * @returns The strategies policy.
   */
  public getPolicy (): StrategyPolicy {
    return this.workerChoiceStrategiesPolicy
  }

  /**
   * Gets the active worker choice strategies in the context task statistics requirements.
   * @returns The strategies task statistics requirements.
   */
  public getTaskStatisticsRequirements (): TaskStatisticsRequirements {
    return this.workerChoiceStrategiesTaskStatisticsRequirements
  }

  /**
   * Sets the default worker choice strategy to use in the context.
   * @param workerChoiceStrategy - The default worker choice strategy to set.
   * @param opts - The worker choice strategy options.
   */
  public setDefaultWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy,
    opts?: WorkerChoiceStrategyOptions
  ): void {
    if (workerChoiceStrategy !== this.defaultWorkerChoiceStrategy) {
      this.defaultWorkerChoiceStrategy = workerChoiceStrategy
      this.addWorkerChoiceStrategy(workerChoiceStrategy, this.pool, opts)
    }
  }

  /**
   * Updates the worker node key in the active worker choice strategies in the context internals.
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the update is successful, `false` otherwise.
   */
  public update (workerNodeKey: number): boolean {
    return Array.from(
      this.workerChoiceStrategies,
      ([_, workerChoiceStrategy]) => workerChoiceStrategy.update(workerNodeKey)
    ).every(r => r)
  }

  /**
   * Executes the given worker choice strategy in the context algorithm.
   * @param workerChoiceStrategy - The worker choice strategy algorithm to execute. @defaultValue this.defaultWorkerChoiceStrategy
   * @param workerNodes - Worker node keys affinity.
   * @returns The key of the worker node.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If after computed retries the worker node key is null or undefined.
   */
  public execute (
    workerChoiceStrategy: WorkerChoiceStrategy = this
      .defaultWorkerChoiceStrategy,
    workerNodes?: number[]
  ): number {
    return this.executeStrategy(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.workerChoiceStrategies.get(workerChoiceStrategy)!,
      workerNodes
    )
  }

  /**
   * Executes the given worker choice strategy.
   * @param workerChoiceStrategy - The worker choice strategy.
   * @param workerNodes - Worker node keys affinity.
   * @returns The key of the worker node.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If after computed retries the worker node key is null or undefined.
   */
  private executeStrategy (
    workerChoiceStrategy: IWorkerChoiceStrategy,
    workerNodes?: number[]
  ): number {
    let workerNodeKey: number | undefined
    let chooseCount = 0
    let retriesCount = 0
    do {
      workerNodeKey = workerChoiceStrategy.choose(workerNodes)
      if (workerNodeKey == null && chooseCount > 0) {
        ++retriesCount
        ++this.retriesCount
      }
      ++chooseCount
    } while (workerNodeKey == null && retriesCount < this.retries)
    if (workerNodeKey == null) {
      throw new Error(
        `Worker node key chosen is null or undefined after ${retriesCount.toString()} retries`
      )
    }
    return workerNodeKey
  }

  /**
   * Removes the worker node key from the active worker choice strategies in the context.
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the removal is successful, `false` otherwise.
   */
  public remove (workerNodeKey: number): boolean {
    return Array.from(
      this.workerChoiceStrategies,
      ([_, workerChoiceStrategy]) => workerChoiceStrategy.remove(workerNodeKey)
    ).every(r => r)
  }

  /**
   * Sets the active worker choice strategies in the context options.
   * @param opts - The worker choice strategy options.
   */
  public setOptions (opts: WorkerChoiceStrategyOptions | undefined): void {
    for (const workerChoiceStrategy of this.workerChoiceStrategies.values()) {
      workerChoiceStrategy.setOptions(opts)
    }
  }

  /**
   * Synchronizes the active worker choice strategies in the context with the given worker choice strategies.
   * @param workerChoiceStrategies - The worker choice strategies to synchronize.
   * @param opts - The worker choice strategy options.
   */
  public syncWorkerChoiceStrategies (
    workerChoiceStrategies: Set<WorkerChoiceStrategy>,
    opts?: WorkerChoiceStrategyOptions
  ): void {
    for (const workerChoiceStrategy of this.workerChoiceStrategies.keys()) {
      if (!workerChoiceStrategies.has(workerChoiceStrategy)) {
        this.removeWorkerChoiceStrategy(workerChoiceStrategy)
      }
    }
    for (const workerChoiceStrategy of workerChoiceStrategies) {
      if (!this.workerChoiceStrategies.has(workerChoiceStrategy)) {
        this.addWorkerChoiceStrategy(workerChoiceStrategy, this.pool, opts)
      }
    }
    this.workerChoiceStrategiesPolicy = buildWorkerChoiceStrategiesPolicy(
      this.workerChoiceStrategies
    )
    this.workerChoiceStrategiesTaskStatisticsRequirements =
      buildWorkerChoiceStrategiesTaskStatisticsRequirements(
        this.workerChoiceStrategies
      )
  }

  /**
   * Adds a worker choice strategy to the context.
   * @param workerChoiceStrategy - The worker choice strategy to add.
   * @param pool - The pool instance.
   * @param opts - The worker choice strategy options.
   * @returns The worker choice strategies.
   */
  private addWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy,
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ): Map<WorkerChoiceStrategy, IWorkerChoiceStrategy> {
    if (!this.workerChoiceStrategies.has(workerChoiceStrategy)) {
      return this.workerChoiceStrategies.set(
        workerChoiceStrategy,
        getWorkerChoiceStrategy<Worker, Data, Response>(
          workerChoiceStrategy,
          pool,
          this,
          opts
        )
      )
    }
    return this.workerChoiceStrategies
  }

  /**
   * Removes a worker choice strategy from the context.
   * @param workerChoiceStrategy - The worker choice strategy to remove.
   * @returns `true` if the worker choice strategy is removed, `false` otherwise.
   */
  private removeWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): boolean {
    return this.workerChoiceStrategies.delete(workerChoiceStrategy)
  }
}
