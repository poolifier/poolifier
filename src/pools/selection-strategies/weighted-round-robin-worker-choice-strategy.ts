import { cpus } from 'node:os'
import type { IPoolInternal } from '../pool-internal'
import type { IPoolWorker } from '../pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  RequiredStatistics
} from './selection-strategies-types'

/**
 * Virtual task runtime.
 */
interface TaskRunTime {
  weight: number
  runTime: number
}

/**
 * Selects the next worker with a weighted round robin scheduling algorithm.
 * Loosely modeled after the weighted round robin queueing algorithm: https://en.wikipedia.org/wiki/Weighted_round_robin.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export class WeightedRoundRobinWorkerChoiceStrategy<
    Worker extends IPoolWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy<Worker, Data, Response> {
  /** @inheritDoc */
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: true,
    avgRunTime: true
  }

  /**
   * Worker id where the current task will be submitted.
   */
  private currentWorkerId: number = 0
  /**
   * Default worker weight.
   */
  private readonly defaultWorkerWeight: number
  /**
   * Per worker virtual task runtime map.
   */
  private readonly workersTaskRunTime: Map<number, TaskRunTime> = new Map<
  number,
  TaskRunTime
  >()

  /**
   * Constructs a worker choice strategy that selects with a weighted round robin scheduling algorithm.
   *
   * @param pool - The pool instance.
   */
  public constructor (pool: IPoolInternal<Worker, Data, Response>) {
    super(pool)
    this.defaultWorkerWeight = this.computeWorkerWeight()
    this.initWorkersTaskRunTime()
  }

  /** @inheritDoc */
  public reset (): boolean {
    this.currentWorkerId = 0
    this.workersTaskRunTime.clear()
    this.initWorkersTaskRunTime()
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    const chosenWorkerKey = this.currentWorkerId
    if (this.isDynamicPool && !this.workersTaskRunTime.has(chosenWorkerKey)) {
      this.initWorkerTaskRunTime(chosenWorkerKey)
    }
    const workerTaskRunTime =
      this.workersTaskRunTime.get(chosenWorkerKey)?.runTime ?? 0
    const workerTaskWeight =
      this.workersTaskRunTime.get(chosenWorkerKey)?.weight ??
      this.defaultWorkerWeight
    if (workerTaskRunTime < workerTaskWeight) {
      this.setWorkerTaskRunTime(
        chosenWorkerKey,
        workerTaskWeight,
        workerTaskRunTime +
          (this.getWorkerVirtualTaskRunTime(chosenWorkerKey) ?? 0)
      )
    } else {
      this.currentWorkerId =
        this.currentWorkerId === this.pool.workers.length - 1
          ? 0
          : this.currentWorkerId + 1
      this.setWorkerTaskRunTime(this.currentWorkerId, workerTaskWeight, 0)
    }
    return chosenWorkerKey
  }

  /** @inheritDoc */
  public remove (workerKey: number): boolean {
    if (this.currentWorkerId === workerKey) {
      if (this.pool.workers.length === 0) {
        this.currentWorkerId = 0
      } else {
        this.currentWorkerId =
          this.currentWorkerId > this.pool.workers.length - 1
            ? this.pool.workers.length - 1
            : this.currentWorkerId
      }
    }
    const workerDeleted = this.workersTaskRunTime.delete(workerKey)
    for (const [key, value] of this.workersTaskRunTime) {
      if (key > workerKey) {
        this.workersTaskRunTime.set(key - 1, value)
      }
    }
    return workerDeleted
  }

  private initWorkersTaskRunTime (): void {
    for (const [index] of this.pool.workers.entries()) {
      this.initWorkerTaskRunTime(index)
    }
  }

  private initWorkerTaskRunTime (workerKey: number): void {
    this.setWorkerTaskRunTime(workerKey, this.defaultWorkerWeight, 0)
  }

  private setWorkerTaskRunTime (
    workerKey: number,
    weight: number,
    runTime: number
  ): void {
    this.workersTaskRunTime.set(workerKey, {
      weight,
      runTime
    })
  }

  private getWorkerVirtualTaskRunTime (workerKey: number): number {
    return this.pool.workers[workerKey].tasksUsage.avgRunTime
  }

  private computeWorkerWeight (): number {
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
