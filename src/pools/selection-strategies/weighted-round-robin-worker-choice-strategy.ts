import { cpus } from 'os'
import type { IPoolInternal } from '../pool-internal'
import type { IPoolWorker } from '../pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type { RequiredStatistics } from './selection-strategies-types'

/**
 * Virtual task runtime.
 */
type TaskRunTime = {
  weight: number
  runTime: number
}

/**
 * Selects the next worker with a weighted round robin scheduling algorithm.
 * Loosely modeled after the weighted round robin queueing algorithm: https://en.wikipedia.org/wiki/Weighted_round_robin.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export class WeightedRoundRobinWorkerChoiceStrategy<
  Worker extends IPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  /** @inheritDoc */
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: true
  }

  /**
   * Worker index where the current task will be submitted.
   */
  private currentWorkerIndex: number = 0
  /**
   * Default worker weight.
   */
  private readonly defaultWorkerWeight: number
  /**
   * Per worker virtual task runtime map.
   */
  private readonly workersTaskRunTime: Map<Worker, TaskRunTime> = new Map<
    Worker,
    TaskRunTime
  >()

  /**
   * Constructs a worker choice strategy that selects with a weighted round robin scheduling algorithm.
   *
   * @param pool The pool instance.
   */
  public constructor (pool: IPoolInternal<Worker, Data, Response>) {
    super(pool)
    this.defaultWorkerWeight = this.computeWorkerWeight()
    this.initWorkersTaskRunTime()
  }

  /** @inheritDoc */
  public reset (): boolean {
    this.currentWorkerIndex = 0
    this.workersTaskRunTime.clear()
    this.initWorkersTaskRunTime()
    return true
  }

  /** @inheritDoc */
  public choose (): Worker {
    let chosenWorker = this.pool.workers[this.currentWorkerIndex]
    if (
      this.isDynamicPool === true &&
      this.workersTaskRunTime.has(chosenWorker) === false
    ) {
      this.initWorkerTaskRunTime(chosenWorker)
    }
    const workerTaskWeight =
      this.workersTaskRunTime.get(chosenWorker)?.weight ??
      this.defaultWorkerWeight
    if (
      (this.workersTaskRunTime.get(chosenWorker)?.runTime ?? 0) <
      workerTaskWeight
    ) {
      this.setWorkerTaskRunTime(
        chosenWorker,
        workerTaskWeight,
        (this.workersTaskRunTime.get(chosenWorker)?.runTime ?? 0) +
          (this.getWorkerVirtualTaskRunTime(chosenWorker) ?? 0)
      )
    } else {
      this.currentWorkerIndex =
        this.pool.workers.length - 1 === this.currentWorkerIndex
          ? 0
          : this.currentWorkerIndex + 1
      chosenWorker = this.pool.workers[this.currentWorkerIndex]
      this.setWorkerTaskRunTime(chosenWorker, workerTaskWeight, 0)
    }
    return chosenWorker
  }

  private initWorkersTaskRunTime (): void {
    for (const worker of this.pool.workers) {
      this.initWorkerTaskRunTime(worker)
    }
  }

  private initWorkerTaskRunTime (worker: Worker): void {
    this.setWorkerTaskRunTime(worker, this.defaultWorkerWeight, 0)
  }

  private setWorkerTaskRunTime (
    worker: Worker,
    weight: number,
    runTime: number
  ): void {
    this.workersTaskRunTime.set(worker, {
      weight,
      runTime
    })
  }

  private getWorkerVirtualTaskRunTime (worker: Worker): number | undefined {
    return this.pool.getWorkerAverageTasksRunTime(worker)
  }

  private computeWorkerWeight (): number {
    let cpusCycleTimeWeight = 0
    for (const cpu of cpus()) {
      // CPU estimated cycle time
      const numberOfDigit = cpu.speed.toString().length - 1
      const cpuCycleTime = 1 / (cpu.speed / Math.pow(10, numberOfDigit))
      cpusCycleTimeWeight += cpuCycleTime * Math.pow(10, numberOfDigit)
    }
    return Math.round(cpusCycleTimeWeight / cpus().length)
  }
}
