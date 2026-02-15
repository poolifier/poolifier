import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'

import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../utils.js'
import {
  buildWorkerChoiceStrategyOptions,
  toggleMedianMeasurementStatisticsRequirements,
} from './selection-strategies-utils.js'

/**
 * Worker choice strategy abstract base class.
 * @template Worker - Type of worker which manages the strategy.
 * @template Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @template Response - Type of execution response. This can only be structured-cloneable data.
 */
export abstract class AbstractWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public abstract readonly name: WorkerChoiceStrategy

  /** @inheritDoc */
  public retriesCount: number

  /** @inheritDoc */
  public readonly strategyPolicy: StrategyPolicy = Object.freeze({
    dynamicWorkerReady: true,
    dynamicWorkerUsage: false,
  })

  /** @inheritDoc */
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements =
    Object.freeze({
      elu: { ...DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS },
      runTime: { ...DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS },
      waitTime: { ...DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS },
    })

  /**
   * The next worker node key.
   */
  protected nextWorkerNodeKey: number | undefined

  /**
   * The previous worker node key.
   */
  protected previousWorkerNodeKey: number

  /**
   * Constructs a worker choice strategy bound to the pool.
   * @param pool - The pool instance.
   * @param opts - The worker choice strategy options.
   */
  public constructor (
    protected readonly pool: IPool<Worker, Data, Response>,
    protected opts?: WorkerChoiceStrategyOptions
  ) {
    this.retriesCount = 0
    this.nextWorkerNodeKey = 0
    this.previousWorkerNodeKey = 0
    this.choose = this.choose.bind(this)
    this.setOptions(this.opts)
  }

  /** @inheritDoc */
  public abstract choose (workerNodeKeys?: number[]): number | undefined

  /** @inheritDoc */
  public abstract remove (workerNodeKey: number): boolean

  /** @inheritDoc */
  public abstract reset (): boolean

  /** @inheritDoc */
  public setOptions (opts: undefined | WorkerChoiceStrategyOptions): void {
    this.opts = buildWorkerChoiceStrategyOptions<Worker, Data, Response>(
      this.pool,
      opts
    )
    this.setTaskStatisticsRequirements(this.opts)
  }

  /** @inheritDoc */
  public abstract update (workerNodeKey: number): boolean

  /**
   * Check the worker node key.
   * @param workerNodeKey - The worker node key to check.
   * @returns The worker node key if it is valid, otherwise undefined.
   */
  protected checkWorkerNodeKey (
    workerNodeKey: number | undefined
  ): number | undefined {
    if (
      workerNodeKey == null ||
      workerNodeKey < 0 ||
      workerNodeKey >= this.pool.workerNodes.length
    ) {
      return undefined
    }
    return workerNodeKey
  }

  /**
   * Check the worker node keys affinity.
   * @param workerNodeKeys - Worker node keys affinity.
   * @returns Worker node keys affinity as a Set for O(1) lookup.
   */
  protected checkWorkerNodeKeys (workerNodeKeys?: number[]): Set<number> {
    if (workerNodeKeys == null) {
      return new Set(this.pool.workerNodeKeys)
    }
    const poolWorkerNodeKeys = new Set(this.pool.workerNodeKeys)
    return new Set(workerNodeKeys.filter(key => poolWorkerNodeKeys.has(key)))
  }

  /**
   * Gets the next worker node key in a round-robin fashion.
   * @returns The next worker node key.
   */
  protected getRoundRobinNextWorkerNodeKey (): number {
    return this.nextWorkerNodeKey === this.pool.workerNodes.length - 1
      ? 0
      : (this.nextWorkerNodeKey ?? this.previousWorkerNodeKey) + 1
  }

  /**
   * Gets the worker node key from a single-element affinity set.
   * @param workerNodeKeys - Worker node keys affinity.
   * @returns The worker node key if the set has a single element and the worker is ready, `undefined` otherwise.
   */
  protected getSingleWorkerNodeKey (
    workerNodeKeys: number[]
  ): number | undefined {
    const workerNodeKey = workerNodeKeys[0]
    return this.isWorkerNodeReady(workerNodeKey) ? workerNodeKey : undefined
  }

  /**
   * Gets the worker node task ELU.
   * If the task statistics require the average ELU, the average ELU is returned.
   * If the task statistics require the median ELU, the median ELU is returned.
   * @param workerNodeKey - The worker node key.
   * @returns The worker node task ELU.
   */
  protected getWorkerNodeTaskElu (workerNodeKey: number): number {
    return this.taskStatisticsRequirements.elu.median
      ? (this.pool.workerNodes[workerNodeKey]?.usage.elu.active.median ?? 0)
      : (this.pool.workerNodes[workerNodeKey]?.usage.elu.active.average ?? 0)
  }

  /**
   * Gets the worker node task runtime.
   * If the task statistics require the average runtime, the average runtime is returned.
   * If the task statistics require the median runtime, the median runtime is returned.
   * @param workerNodeKey - The worker node key.
   * @returns The worker node task runtime.
   */
  protected getWorkerNodeTaskRunTime (workerNodeKey: number): number {
    return this.taskStatisticsRequirements.runTime.median
      ? (this.pool.workerNodes[workerNodeKey]?.usage.runTime.median ?? 0)
      : (this.pool.workerNodes[workerNodeKey]?.usage.runTime.average ?? 0)
  }

  /**
   * Gets the worker node task wait time.
   * If the task statistics require the average wait time, the average wait time is returned.
   * If the task statistics require the median wait time, the median wait time is returned.
   * @param workerNodeKey - The worker node key.
   * @returns The worker node task wait time.
   */
  protected getWorkerNodeTaskWaitTime (workerNodeKey: number): number {
    return this.taskStatisticsRequirements.waitTime.median
      ? (this.pool.workerNodes[workerNodeKey]?.usage.waitTime.median ?? 0)
      : (this.pool.workerNodes[workerNodeKey]?.usage.waitTime.average ?? 0)
  }

  /**
   * Whether the worker node is ready or not.
   * @param workerNodeKey - The worker node key.
   * @returns Whether the worker node is ready or not.
   */
  protected isWorkerNodeReady (workerNodeKey: number): boolean {
    return this.pool.workerNodes[workerNodeKey]?.info.ready ?? false
  }

  protected resetWorkerNodeKeyProperties (): void {
    this.nextWorkerNodeKey = 0
    this.previousWorkerNodeKey = 0
  }

  /**
   * Sets safely the previous worker node key.
   * @param workerNodeKey - The worker node key.
   */
  protected setPreviousWorkerNodeKey (workerNodeKey: number | undefined): void {
    this.previousWorkerNodeKey =
      workerNodeKey != null &&
      workerNodeKey >= 0 &&
      workerNodeKey < this.pool.workerNodes.length
        ? workerNodeKey
        : this.previousWorkerNodeKey
  }

  protected setTaskStatisticsRequirements (
    opts: undefined | WorkerChoiceStrategyOptions
  ): void {
    toggleMedianMeasurementStatisticsRequirements(
      this.taskStatisticsRequirements.runTime,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      opts!.runTime!.median
    )
    toggleMedianMeasurementStatisticsRequirements(
      this.taskStatisticsRequirements.waitTime,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      opts!.waitTime!.median
    )
    toggleMedianMeasurementStatisticsRequirements(
      this.taskStatisticsRequirements.elu,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      opts!.elu!.median
    )
  }
}
