import { cpus } from 'os'
import type { AbstractPoolWorker } from '../abstract-pool-worker'
import type { IPoolInternal } from '../pool-internal'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'

/**
 * Task run time.
 */
interface TaskRunTime {
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
  Worker extends AbstractPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  /**
   * Worker index where the previous task was submitted.
   */
  private previousWorkerIndex: number = 0
  /**
   * Worker index where the current task will be submitted.
   */
  private currentWorkerIndex: number = 0
  /**
   * Default worker weight.
   */
  private defaultWorkerWeight: number
  /**
   * Per worker task runtime map.
   */
  private workerTaskRunTime: Map<Worker, TaskRunTime> = new Map<
    Worker,
    TaskRunTime
  >()

  /**
   * Constructs a worker choice strategy that selects based a weighted round robin scheduling algorithm.
   *
   * @param pool The pool instance.
   */
  public constructor (pool: IPoolInternal<Worker, Data, Response>) {
    super(pool)
    this.defaultWorkerWeight = this.computeWorkerWeight()
    this.initWorkerTaskRunTime()
  }

  /** @inheritDoc */
  public choose (): Worker {
    const currentWorker = this.pool.workers[this.currentWorkerIndex]
    if (this.isDynamicPool) {
      this.workerTaskRunTime.has(currentWorker) === false &&
        this.workerTaskRunTime.set(currentWorker, {
          weight: this.defaultWorkerWeight,
          runTime: 0
        })
    }
    const workerVirtualTaskRunTime =
      this.getWorkerVirtualTaskRunTime(currentWorker) ?? 0
    const workerTaskWeight =
      this.workerTaskRunTime.get(currentWorker)?.weight ??
      this.defaultWorkerWeight
    if (this.currentWorkerIndex === this.previousWorkerIndex) {
      const workerTaskRunTime =
        (this.workerTaskRunTime.get(currentWorker)?.runTime ?? 0) +
        workerVirtualTaskRunTime
      this.workerTaskRunTime.set(currentWorker, {
        weight: workerTaskWeight,
        runTime: workerTaskRunTime
      })
    } else {
      this.workerTaskRunTime.set(currentWorker, {
        weight: workerTaskWeight,
        runTime: 0
      })
    }
    if (
      workerVirtualTaskRunTime <
      (this.workerTaskRunTime.get(currentWorker) ?? this.defaultWorkerWeight)
    ) {
      this.previousWorkerIndex = this.currentWorkerIndex
    } else {
      this.previousWorkerIndex = this.currentWorkerIndex
      this.currentWorkerIndex =
        this.pool.workers.length - 1 === this.currentWorkerIndex
          ? 0
          : this.currentWorkerIndex + 1
    }
    return this.pool.workers[this.currentWorkerIndex]
  }

  private computeWorkerWeight () {
    let cpusCycleTimeWeight = 0
    for (let cpu = 0; cpu < cpus().length; cpu++) {
      // CPU estimated cycle time
      const numberOfDigit = cpus()[cpu].speed.toString().length - 1
      const cpuCycleTime = 1 / (cpus()[cpu].speed / Math.pow(10, numberOfDigit))
      cpusCycleTimeWeight += cpuCycleTime * Math.pow(10, numberOfDigit)
    }
    return cpusCycleTimeWeight / cpus().length
  }

  private initWorkerTaskRunTime () {
    for (const worker of this.pool.workers) {
      this.workerTaskRunTime.set(worker, {
        weight: this.defaultWorkerWeight,
        runTime: 0
      })
    }
  }

  private getWorkerVirtualTaskRunTime (worker: Worker): number | undefined {
    return this.pool.getWorkerAverageTasksRunTime(worker)
  }
}
