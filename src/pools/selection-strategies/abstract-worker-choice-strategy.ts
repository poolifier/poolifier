import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'

import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../utils.js'
import {
  buildWorkerChoiceStrategyOptions,
  toggleMedianMeasurementStatisticsRequirements,
} from './selection-strategies-utils.js'

/**
 * Worker choice strategy abstract base class.
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export abstract class AbstractWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IWorkerChoiceStrategy {
  /**
   * The next worker node key.
   */
  protected nextWorkerNodeKey: number | undefined = 0

  /**
   * The previous worker node key.
   */
  protected previousWorkerNodeKey = 0

  /** @inheritDoc */
  public readonly strategyPolicy: StrategyPolicy = {
    dynamicWorkerReady: true,
    dynamicWorkerUsage: false,
  }

  /** @inheritDoc */
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements = {
    elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    runTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    waitTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  }

  /**
   * Constructs a worker choice strategy bound to the pool.
   * @param pool - The pool instance.
   * @param opts - The worker choice strategy options.
   */
  public constructor (
    protected readonly pool: IPool<Worker, Data, Response>,
    protected opts?: WorkerChoiceStrategyOptions
  ) {
    this.choose = this.choose.bind(this)
    this.setOptions(this.opts)
  }

  /**
   * Check the next worker node key.
   */
  protected checkNextWorkerNodeKey (): void {
    if (
      this.nextWorkerNodeKey != null &&
      (this.nextWorkerNodeKey < 0 ||
        !this.isWorkerNodeReady(this.nextWorkerNodeKey))
    ) {
      delete this.nextWorkerNodeKey
    }
  }

  /**
   * Check worker node keys affinity.
   * @param workerNodes - Worker node keys affinity
   * @returns Worker node keys affinity
   */
  protected checkWorkerNodes (workerNodes?: number[]): number[] {
    const poolWorkerNodesKeys = this.pool.workerNodes.map((_, index) => index)
    if (workerNodes == null) {
      return poolWorkerNodesKeys
    }
    if (!Array.isArray(workerNodes)) {
      throw new TypeError('Worker nodes must be an array')
    }
    if (
      workerNodes.filter(workerNodeKey =>
        poolWorkerNodesKeys.includes(workerNodeKey)
      ).length === 0
    ) {
      throw new Error('Worker nodes must be part of the pool worker nodes')
    }
    return workerNodes
  }

  /**
   *
   * @returns
   */
  protected getRoundRobinNextWorkerNodeKey (): number {
    return this.nextWorkerNodeKey === this.pool.workerNodes.length - 1
      ? 0
      : (this.nextWorkerNodeKey ?? this.previousWorkerNodeKey) + 1
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
      ? this.pool.workerNodes[workerNodeKey].usage.elu.active.median ?? 0
      : this.pool.workerNodes[workerNodeKey].usage.elu.active.average ?? 0
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
      ? this.pool.workerNodes[workerNodeKey].usage.runTime.median ?? 0
      : this.pool.workerNodes[workerNodeKey].usage.runTime.average ?? 0
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
      ? this.pool.workerNodes[workerNodeKey].usage.waitTime.median ?? 0
      : this.pool.workerNodes[workerNodeKey].usage.waitTime.average ?? 0
  }

  /**
   * Whether the worker node is ready or not.
   * @param workerNodeKey - The worker node key.
   * @returns Whether the worker node is ready or not.
   */
  protected isWorkerNodeReady (workerNodeKey: number): boolean {
    return this.pool.workerNodes[workerNodeKey]?.info?.ready ?? false
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
      workerNodeKey != null && workerNodeKey >= 0
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

  /** @inheritDoc */
  public abstract choose (workerNodes?: number[]): number | undefined

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
}
