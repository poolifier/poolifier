import { cpus } from 'node:os'
import type { IPoolInternal } from '../pool-internal'
import type { IWorker } from '../worker'
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
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: true,
    avgRunTime: true,
    medRunTime: false
  }

  /**
   * Worker node id where the current task will be submitted.
   */
  private currentWorkerNodeId: number = 0
  /**
   * Default worker weight.
   */
  private readonly defaultWorkerWeight: number
  /**
   * Workers' virtual task runtime.
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
    this.currentWorkerNodeId = 0
    this.workersTaskRunTime.clear()
    this.initWorkersTaskRunTime()
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    const chosenWorkerNodeKey = this.currentWorkerNodeId
    if (
      this.isDynamicPool &&
      !this.workersTaskRunTime.has(chosenWorkerNodeKey)
    ) {
      this.initWorkerTaskRunTime(chosenWorkerNodeKey)
    }
    const workerTaskRunTime =
      this.workersTaskRunTime.get(chosenWorkerNodeKey)?.runTime ?? 0
    const workerTaskWeight =
      this.workersTaskRunTime.get(chosenWorkerNodeKey)?.weight ??
      this.defaultWorkerWeight
    if (workerTaskRunTime < workerTaskWeight) {
      this.setWorkerTaskRunTime(
        chosenWorkerNodeKey,
        workerTaskWeight,
        workerTaskRunTime +
          (this.getWorkerVirtualTaskRunTime(chosenWorkerNodeKey) ?? 0)
      )
    } else {
      this.currentWorkerNodeId =
        this.currentWorkerNodeId === this.pool.workerNodes.length - 1
          ? 0
          : this.currentWorkerNodeId + 1
      this.setWorkerTaskRunTime(this.currentWorkerNodeId, workerTaskWeight, 0)
    }
    return chosenWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.currentWorkerNodeId === workerNodeKey) {
      if (this.pool.workerNodes.length === 0) {
        this.currentWorkerNodeId = 0
      } else {
        this.currentWorkerNodeId =
          this.currentWorkerNodeId > this.pool.workerNodes.length - 1
            ? this.pool.workerNodes.length - 1
            : this.currentWorkerNodeId
      }
    }
    const deleted = this.workersTaskRunTime.delete(workerNodeKey)
    for (const [key, value] of this.workersTaskRunTime) {
      if (key > workerNodeKey) {
        this.workersTaskRunTime.set(key - 1, value)
      }
    }
    return deleted
  }

  private initWorkersTaskRunTime (): void {
    for (const [index] of this.pool.workerNodes.entries()) {
      this.initWorkerTaskRunTime(index)
    }
  }

  private initWorkerTaskRunTime (workerNodeKey: number): void {
    this.setWorkerTaskRunTime(workerNodeKey, this.defaultWorkerWeight, 0)
  }

  private setWorkerTaskRunTime (
    workerNodeKey: number,
    weight: number,
    runTime: number
  ): void {
    this.workersTaskRunTime.set(workerNodeKey, {
      weight,
      runTime
    })
  }

  private getWorkerVirtualTaskRunTime (workerNodeKey: number): number {
    return this.pool.workerNodes[workerNodeKey].tasksUsage.avgRunTime
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
