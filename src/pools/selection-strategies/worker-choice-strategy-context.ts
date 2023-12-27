import { buildInternalWorkerChoiceStrategyOptions } from '../../utils.js'
import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import { FairShareWorkerChoiceStrategy } from './fair-share-worker-choice-strategy.js'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from './interleaved-weighted-round-robin-worker-choice-strategy.js'
import { LeastBusyWorkerChoiceStrategy } from './least-busy-worker-choice-strategy.js'
import { LeastUsedWorkerChoiceStrategy } from './least-used-worker-choice-strategy.js'
import { LeastEluWorkerChoiceStrategy } from './least-elu-worker-choice-strategy.js'
import { RoundRobinWorkerChoiceStrategy } from './round-robin-worker-choice-strategy.js'
import type {
  IWorkerChoiceStrategy,
  InternalWorkerChoiceStrategyOptions,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategy
} from './selection-strategies-types.js'
import { WorkerChoiceStrategies } from './selection-strategies-types.js'
import { WeightedRoundRobinWorkerChoiceStrategy } from './weighted-round-robin-worker-choice-strategy.js'

/**
 * The worker choice strategy context.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
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
   * @param workerChoiceStrategy - The worker choice strategy.
   * @param opts - The worker choice strategy options.
   */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    private workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN,
    private opts?: InternalWorkerChoiceStrategyOptions
  ) {
    this.opts = buildInternalWorkerChoiceStrategyOptions(
      pool.info.maxSize,
      this.opts
    )
    this.execute = this.execute.bind(this)
    this.workerChoiceStrategies = new Map<
    WorkerChoiceStrategy,
    IWorkerChoiceStrategy
    >([
      [
        WorkerChoiceStrategies.ROUND_ROBIN,
        new (RoundRobinWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          this.opts
        )
      ],
      [
        WorkerChoiceStrategies.LEAST_USED,
        new (LeastUsedWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          this.opts
        )
      ],
      [
        WorkerChoiceStrategies.LEAST_BUSY,
        new (LeastBusyWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          this.opts
        )
      ],
      [
        WorkerChoiceStrategies.LEAST_ELU,
        new (LeastEluWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          this.opts
        )
      ],
      [
        WorkerChoiceStrategies.FAIR_SHARE,
        new (FairShareWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          this.opts
        )
      ],
      [
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
        new (WeightedRoundRobinWorkerChoiceStrategy.bind(this))<
        Worker,
        Data,
        Response
        >(pool, this.opts)
      ],
      [
        WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN,
        new (InterleavedWeightedRoundRobinWorkerChoiceStrategy.bind(this))<
        Worker,
        Data,
        Response
        >(pool, this.opts)
      ]
    ])
  }

  /**
   * Gets the strategy policy in the context.
   *
   * @returns The strategy policy.
   */
  public getStrategyPolicy (): StrategyPolicy {
    return (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategy
      ) as IWorkerChoiceStrategy
    ).strategyPolicy
  }

  /**
   * Gets the worker choice strategy in the context task statistics requirements.
   *
   * @returns The task statistics requirements.
   */
  public getTaskStatisticsRequirements (): TaskStatisticsRequirements {
    return (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategy
      ) as IWorkerChoiceStrategy
    ).taskStatisticsRequirements
  }

  /**
   * Sets the worker choice strategy to use in the context.
   *
   * @param workerChoiceStrategy - The worker choice strategy to set.
   */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    if (this.workerChoiceStrategy !== workerChoiceStrategy) {
      this.workerChoiceStrategy = workerChoiceStrategy
    }
    this.workerChoiceStrategies.get(this.workerChoiceStrategy)?.reset()
  }

  /**
   * Updates the worker node key in the worker choice strategy in the context internals.
   *
   * @returns `true` if the update is successful, `false` otherwise.
   */
  public update (workerNodeKey: number): boolean {
    return (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategy
      ) as IWorkerChoiceStrategy
    ).update(workerNodeKey)
  }

  /**
   * Executes the worker choice strategy in the context algorithm.
   *
   * @returns The key of the worker node.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If after configured retries the worker node key is null or undefined.
   */
  public execute (): number {
    const workerChoiceStrategy = this.workerChoiceStrategies.get(
      this.workerChoiceStrategy
    ) as IWorkerChoiceStrategy
    if (!workerChoiceStrategy.hasPoolWorkerNodesReady()) {
      return this.execute()
    }
    return this.executeStrategy(workerChoiceStrategy)
  }

  /**
   * Executes the given worker choice strategy.
   *
   * @param workerChoiceStrategy - The worker choice strategy.
   * @returns The key of the worker node.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If after configured retries the worker node key is null or undefined.
   */
  private executeStrategy (workerChoiceStrategy: IWorkerChoiceStrategy): number {
    let workerNodeKey: number | undefined
    let chooseCount = 0
    let retriesCount = 0
    do {
      workerNodeKey = workerChoiceStrategy.choose()
      if (workerNodeKey == null && chooseCount > 0) {
        retriesCount++
      }
      chooseCount++
    } while (
      workerNodeKey == null &&
      retriesCount < (this.opts?.retries as number)
    )
    if (workerNodeKey == null) {
      throw new Error(
        `Worker node key chosen is null or undefined after ${retriesCount} retries`
      )
    }
    return workerNodeKey
  }

  /**
   * Removes the worker node key from the worker choice strategy in the context.
   *
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the removal is successful, `false` otherwise.
   */
  public remove (workerNodeKey: number): boolean {
    return (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategy
      ) as IWorkerChoiceStrategy
    ).remove(workerNodeKey)
  }

  /**
   * Sets the worker choice strategies in the context options.
   *
   * @param pool - The pool instance.
   * @param opts - The worker choice strategy options.
   */
  public setOptions (
    pool: IPool<Worker, Data, Response>,
    opts?: InternalWorkerChoiceStrategyOptions
  ): void {
    this.opts = buildInternalWorkerChoiceStrategyOptions(
      pool.info.maxSize,
      opts
    )
    for (const workerChoiceStrategy of this.workerChoiceStrategies.values()) {
      workerChoiceStrategy.setOptions(this.opts)
    }
  }
}
