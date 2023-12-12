import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import { FairShareWorkerChoiceStrategy } from './fair-share-worker-choice-strategy'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from './interleaved-weighted-round-robin-worker-choice-strategy'
import { LeastBusyWorkerChoiceStrategy } from './least-busy-worker-choice-strategy'
import { LeastUsedWorkerChoiceStrategy } from './least-used-worker-choice-strategy'
import { LeastEluWorkerChoiceStrategy } from './least-elu-worker-choice-strategy'
import { RoundRobinWorkerChoiceStrategy } from './round-robin-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'
import { WorkerChoiceStrategies } from './selection-strategies-types'
import { WeightedRoundRobinWorkerChoiceStrategy } from './weighted-round-robin-worker-choice-strategy'

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
   * The number of times the worker choice strategy in the context has been retried.
   */
  private retriesCount = 0

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
    private opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    this.opts = { ...DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS, ...opts }
    this.execute = this.execute.bind(this)
    this.workerChoiceStrategies = new Map<
    WorkerChoiceStrategy,
    IWorkerChoiceStrategy
    >([
      [
        WorkerChoiceStrategies.ROUND_ROBIN,
        new (RoundRobinWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          opts
        )
      ],
      [
        WorkerChoiceStrategies.LEAST_USED,
        new (LeastUsedWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          opts
        )
      ],
      [
        WorkerChoiceStrategies.LEAST_BUSY,
        new (LeastBusyWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          opts
        )
      ],
      [
        WorkerChoiceStrategies.LEAST_ELU,
        new (LeastEluWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          opts
        )
      ],
      [
        WorkerChoiceStrategies.FAIR_SHARE,
        new (FairShareWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          opts
        )
      ],
      [
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
        new (WeightedRoundRobinWorkerChoiceStrategy.bind(this))<
        Worker,
        Data,
        Response
        >(pool, opts)
      ],
      [
        WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN,
        new (InterleavedWeightedRoundRobinWorkerChoiceStrategy.bind(this))<
        Worker,
        Data,
        Response
        >(pool, opts)
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
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If after configured retries the worker node key is null or undefined .
   */
  public execute (): number {
    const workerNodeKey = (
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategy
      ) as IWorkerChoiceStrategy
    ).choose()
    if (
      workerNodeKey == null &&
      (this.retriesCount < (this.opts.retries as number) ||
        this.opts.retries === Infinity)
    ) {
      this.retriesCount++
      return this.execute()
    } else if (workerNodeKey == null) {
      throw new Error(
        `Worker node key chosen is null or undefined after ${this.retriesCount} retries`
      )
    }
    this.retriesCount = 0
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
   * @param opts - The worker choice strategy options.
   */
  public setOptions (opts: WorkerChoiceStrategyOptions): void {
    this.opts = { ...DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS, ...opts }
    for (const workerChoiceStrategy of this.workerChoiceStrategies.values()) {
      workerChoiceStrategy.setOptions(opts)
    }
  }
}
