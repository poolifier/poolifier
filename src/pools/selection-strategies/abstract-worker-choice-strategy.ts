import { cpus } from 'node:os'
import {
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
} from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Worker choice strategy abstract base class.
 *
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
  protected nextWorkerNodeKey: number = 0

  /** @inheritDoc */
  public readonly strategyPolicy: StrategyPolicy = {
    useDynamicWorker: false
  }

  /** @inheritDoc */
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements = {
    runTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    waitTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS
  }

  /**
   * Constructs a worker choice strategy bound to the pool.
   *
   * @param pool - The pool instance.
   * @param opts - The worker choice strategy options.
   */
  public constructor (
    protected readonly pool: IPool<Worker, Data, Response>,
    protected opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    this.choose = this.choose.bind(this)
  }

  protected setTaskStatisticsRequirements (
    opts: WorkerChoiceStrategyOptions
  ): void {
    if (
      this.taskStatisticsRequirements.runTime.average &&
      opts.runTime?.median === true
    ) {
      this.taskStatisticsRequirements.runTime.average = false
      this.taskStatisticsRequirements.runTime.median = opts.runTime
        .median as boolean
    }
    if (
      this.taskStatisticsRequirements.runTime.median &&
      opts.runTime?.median === false
    ) {
      this.taskStatisticsRequirements.runTime.average = true
      this.taskStatisticsRequirements.runTime.median = opts.runTime
        .median as boolean
    }
    if (
      this.taskStatisticsRequirements.waitTime.average &&
      opts.waitTime?.median === true
    ) {
      this.taskStatisticsRequirements.waitTime.average = false
      this.taskStatisticsRequirements.waitTime.median = opts.waitTime
        .median as boolean
    }
    if (
      this.taskStatisticsRequirements.waitTime.median &&
      opts.waitTime?.median === false
    ) {
      this.taskStatisticsRequirements.waitTime.average = true
      this.taskStatisticsRequirements.waitTime.median = opts.waitTime
        .median as boolean
    }
    if (
      this.taskStatisticsRequirements.elu.average &&
      opts.elu?.median === true
    ) {
      this.taskStatisticsRequirements.elu.average = false
      this.taskStatisticsRequirements.elu.median = opts.elu.median as boolean
    }
    if (
      this.taskStatisticsRequirements.elu.median &&
      opts.elu?.median === false
    ) {
      this.taskStatisticsRequirements.elu.average = true
      this.taskStatisticsRequirements.elu.median = opts.elu.median as boolean
    }
  }

  /** @inheritDoc */
  public abstract reset (): boolean

  /** @inheritDoc */
  public abstract update (workerNodeKey: number): boolean

  /** @inheritDoc */
  public abstract choose (): number

  /** @inheritDoc */
  public abstract remove (workerNodeKey: number): boolean

  /** @inheritDoc */
  public setOptions (opts: WorkerChoiceStrategyOptions): void {
    this.opts = opts ?? DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
    this.setTaskStatisticsRequirements(this.opts)
  }

  /**
   * Whether the worker node is ready or not.
   *
   * @param workerNodeKey - The worker node key.
   * @returns Whether the worker node is ready or not.
   */
  protected isWorkerNodeReady (workerNodeKey: number): boolean {
    return this.pool.workerNodes[workerNodeKey].info.ready
  }

  /**
   * Gets the worker task runtime.
   * If the task statistics require the average runtime, the average runtime is returned.
   * If the task statistics require the median runtime , the median runtime is returned.
   *
   * @param workerNodeKey - The worker node key.
   * @returns The worker task runtime.
   */
  protected getWorkerTaskRunTime (workerNodeKey: number): number {
    return this.taskStatisticsRequirements.runTime.median
      ? this.pool.workerNodes[workerNodeKey].usage.runTime?.median ?? 0
      : this.pool.workerNodes[workerNodeKey].usage.runTime?.average ?? 0
  }

  /**
   * Gets the worker task wait time.
   * If the task statistics require the average wait time, the average wait time is returned.
   * If the task statistics require the median wait time, the median wait time is returned.
   *
   * @param workerNodeKey - The worker node key.
   * @returns The worker task wait time.
   */
  protected getWorkerTaskWaitTime (workerNodeKey: number): number {
    return this.taskStatisticsRequirements.waitTime.median
      ? this.pool.workerNodes[workerNodeKey].usage.waitTime?.median ?? 0
      : this.pool.workerNodes[workerNodeKey].usage.waitTime?.average ?? 0
  }

  /**
   * Gets the worker task ELU.
   * If the task statistics require the average ELU, the average ELU is returned.
   * If the task statistics require the median ELU, the median ELU is returned.
   *
   * @param workerNodeKey - The worker node key.
   * @returns The worker task ELU.
   */
  protected getWorkerTaskElu (workerNodeKey: number): number {
    return this.taskStatisticsRequirements.elu.median
      ? this.pool.workerNodes[workerNodeKey].usage.elu.active?.median ?? 0
      : this.pool.workerNodes[workerNodeKey].usage.elu.active?.average ?? 0
  }

  protected computeDefaultWorkerWeight (): number {
    let cpusCycleTimeWeight = 0
    for (const cpu of cpus()) {
      // CPU estimated cycle time
      const numberOfDigits = cpu.speed.toString().length - 1
      const cpuCycleTime = 1 / (cpu.speed / Math.pow(10, numberOfDigits))
      cpusCycleTimeWeight += cpuCycleTime * Math.pow(10, numberOfDigits)
    }
    return Math.round(cpusCycleTimeWeight / cpus().length)
  }
}
