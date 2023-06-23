import { cpus } from 'node:os'
import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
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
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export abstract class AbstractWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IWorkerChoiceStrategy {
  // /**
  //  * Toggles finding the last free worker node key.
  //  */
  // private toggleFindLastFreeWorkerNodeKey: boolean = false

  /**
   * Id of the next worker node.
   */
  protected nextWorkerNodeId: number = 0

  /** @inheritDoc */
  public readonly strategyPolicy: StrategyPolicy = {
    useDynamicWorker: false
  }

  /** @inheritDoc */
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements = {
    runTime: {
      aggregate: false,
      average: false,
      median: false
    },
    waitTime: {
      aggregate: false,
      average: false,
      median: false
    },
    elu: {
      aggregate: false,
      average: false,
      median: false
    }
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
    opts = opts ?? DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
    this.setTaskStatisticsRequirements(opts)
    this.opts = opts
  }

  // /**
  //  * Finds a free worker node key.
  //  *
  //  * @returns The free worker node key or `-1` if there is no free worker node.
  //  */
  // protected findFreeWorkerNodeKey (): number {
  //   if (this.toggleFindLastFreeWorkerNodeKey) {
  //     this.toggleFindLastFreeWorkerNodeKey = false
  //     return this.findLastFreeWorkerNodeKey()
  //   }
  //   this.toggleFindLastFreeWorkerNodeKey = true
  //   return this.findFirstFreeWorkerNodeKey()
  // }

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
      ? this.pool.workerNodes[workerNodeKey].workerUsage.runTime.median
      : this.pool.workerNodes[workerNodeKey].workerUsage.runTime.average
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
      ? this.pool.workerNodes[workerNodeKey].workerUsage.waitTime.median
      : this.pool.workerNodes[workerNodeKey].workerUsage.waitTime.average
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
      ? this.pool.workerNodes[workerNodeKey].workerUsage.elu.active.median
      : this.pool.workerNodes[workerNodeKey].workerUsage.elu.active.average
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

  // /**
  //  * Finds the first free worker node key based on the number of tasks the worker has applied.
  //  *
  //  * If a worker is found with `0` executing tasks, it is detected as free and its worker node key is returned.
  //  *
  //  * If no free worker is found, `-1` is returned.
  //  *
  //  * @returns A worker node key if there is one, `-1` otherwise.
  //  */
  // private findFirstFreeWorkerNodeKey (): number {
  //   return this.pool.workerNodes.findIndex(workerNode => {
  //     return workerNode.workerUsage.tasks.executing === 0
  //   })
  // }

  // /**
  //  * Finds the last free worker node key based on the number of tasks the worker has applied.
  //  *
  //  * If a worker is found with `0` executing tasks, it is detected as free and its worker node key is returned.
  //  *
  //  * If no free worker is found, `-1` is returned.
  //  *
  //  * @returns A worker node key if there is one, `-1` otherwise.
  //  */
  // private findLastFreeWorkerNodeKey (): number {
  //   // It requires node >= 18.0.0:
  //   // return this.workerNodes.findLastIndex(workerNode => {
  //   //   return workerNode.workerUsage.tasks.executing === 0
  //   // })
  //   for (
  //     let workerNodeKey = this.pool.workerNodes.length - 1;
  //     workerNodeKey >= 0;
  //     workerNodeKey--
  //   ) {
  //     if (
  //       this.pool.workerNodes[workerNodeKey].workerUsage.tasks.executing === 0
  //     ) {
  //       return workerNodeKey
  //     }
  //   }
  //   return -1
  // }
}
