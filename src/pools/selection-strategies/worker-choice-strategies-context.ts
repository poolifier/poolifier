import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types.js'
import { WorkerChoiceStrategies } from './selection-strategies-types.js'
import {
  getWorkerChoiceStrategiesRetries,
  getWorkerChoiceStrategy
} from './selection-strategies-utils.js'

/**
 * The worker choice strategies context.
 *
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
   * The maximum number of worker choice strategies execution retries.
   */
  private readonly retries: number

  /**
   * Worker choice strategies context constructor.
   *
   * @param pool - The pool instance.
   * @param workerChoiceStrategies - The worker choice strategies. @defaultValue [WorkerChoiceStrategies.ROUND_ROBIN]
   * @param opts - The worker choice strategy options.
   */
  public constructor (
    private readonly pool: IPool<Worker, Data, Response>,
    workerChoiceStrategies: WorkerChoiceStrategy[] = [
      WorkerChoiceStrategies.ROUND_ROBIN
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
    this.retriesCount = 0
    this.retries = getWorkerChoiceStrategiesRetries<Worker, Data, Response>(
      this.pool,
      opts
    )
  }

  /**
   * Gets the active worker choice strategies policy in the context.
   *
   * @returns The strategies policy.
   */
  public getPolicy (): StrategyPolicy {
    const policies: StrategyPolicy[] = []
    for (const workerChoiceStrategy of this.workerChoiceStrategies.values()) {
      policies.push(workerChoiceStrategy.strategyPolicy)
    }
    return {
      dynamicWorkerUsage: policies.some(p => p.dynamicWorkerUsage),
      dynamicWorkerReady: policies.some(p => p.dynamicWorkerReady)
    }
  }

  /**
   * Gets the active worker choice strategies in the context task statistics requirements.
   *
   * @returns The task statistics requirements.
   */
  public getTaskStatisticsRequirements (): TaskStatisticsRequirements {
    const taskStatisticsRequirements: TaskStatisticsRequirements[] = []
    for (const workerChoiceStrategy of this.workerChoiceStrategies.values()) {
      taskStatisticsRequirements.push(
        workerChoiceStrategy.taskStatisticsRequirements
      )
    }
    return {
      runTime: {
        aggregate: taskStatisticsRequirements.some(r => r.runTime.aggregate),
        average: taskStatisticsRequirements.some(r => r.runTime.average),
        median: taskStatisticsRequirements.some(r => r.runTime.median)
      },
      waitTime: {
        aggregate: taskStatisticsRequirements.some(r => r.waitTime.aggregate),
        average: taskStatisticsRequirements.some(r => r.waitTime.average),
        median: taskStatisticsRequirements.some(r => r.waitTime.median)
      },
      elu: {
        aggregate: taskStatisticsRequirements.some(r => r.elu.aggregate),
        average: taskStatisticsRequirements.some(r => r.elu.average),
        median: taskStatisticsRequirements.some(r => r.elu.median)
      }
    }
  }

  /**
   * Sets the default worker choice strategy to use in the context.
   *
   * @param workerChoiceStrategy - The default worker choice strategy to set.
   * @param opts - The worker choice strategy options.
   */
  public setDefaultWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy,
    opts?: WorkerChoiceStrategyOptions
  ): void {
    this.defaultWorkerChoiceStrategy = workerChoiceStrategy
    this.addWorkerChoiceStrategy(workerChoiceStrategy, this.pool, opts)
  }

  /**
   * Updates the worker node key in the active worker choice strategies in the context internals.
   *
   * @returns `true` if the update is successful, `false` otherwise.
   */
  public update (workerNodeKey: number): boolean {
    const res: boolean[] = []
    for (const workerChoiceStrategy of this.workerChoiceStrategies.values()) {
      res.push(workerChoiceStrategy.update(workerNodeKey))
    }
    return res.every(r => r)
  }

  /**
   * Executes the worker choice strategy in the context algorithm.
   *
   * @param workerChoiceStrategy - The worker choice strategy algorithm to execute. @defaultValue this.defaultWorkerChoiceStrategy
   * @returns The key of the worker node.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If after computed retries the worker node key is null or undefined.
   */
  public execute (
    workerChoiceStrategy: WorkerChoiceStrategy = this
      .defaultWorkerChoiceStrategy
  ): number {
    return this.executeStrategy(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.workerChoiceStrategies.get(workerChoiceStrategy)!
    )
  }

  /**
   * Executes the given worker choice strategy.
   *
   * @param workerChoiceStrategy - The worker choice strategy.
   * @returns The key of the worker node.
   * @throws {@link https://nodejs.org/api/errors.html#class-error} If after computed retries the worker node key is null or undefined.
   */
  private executeStrategy (workerChoiceStrategy: IWorkerChoiceStrategy): number {
    let workerNodeKey: number | undefined
    let chooseCount = 0
    let retriesCount = 0
    do {
      workerNodeKey = workerChoiceStrategy.choose()
      if (workerNodeKey == null && chooseCount > 0) {
        ++retriesCount
        ++this.retriesCount
      }
      ++chooseCount
    } while (workerNodeKey == null && retriesCount < this.retries)
    if (workerNodeKey == null) {
      throw new Error(
        `Worker node key chosen is null or undefined after ${retriesCount} retries`
      )
    }
    return workerNodeKey
  }

  /**
   * Removes the worker node key from the active worker choice strategies in the context.
   *
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the removal is successful, `false` otherwise.
   */
  public remove (workerNodeKey: number): boolean {
    const res: boolean[] = []
    for (const workerChoiceStrategy of this.workerChoiceStrategies.values()) {
      res.push(workerChoiceStrategy.remove(workerNodeKey))
    }
    return res.every(r => r)
  }

  /**
   * Sets the active worker choice strategies in the context options.
   *
   * @param opts - The worker choice strategy options.
   */
  public setOptions (opts: WorkerChoiceStrategyOptions | undefined): void {
    for (const workerChoiceStrategy of this.workerChoiceStrategies.values()) {
      workerChoiceStrategy.setOptions(opts)
    }
  }

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

  // private removeWorkerChoiceStrategy (
  //   workerChoiceStrategy: WorkerChoiceStrategy
  // ): boolean {
  //   return this.workerChoiceStrategies.delete(workerChoiceStrategy)
  // }
}
