import {
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
} from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import {
  type IWorkerChoiceStrategy,
  Measurements,
  type TaskStatisticsRequirements,
  type WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the next worker with a fair share scheduling algorithm.
 * Loosely modeled after the fair queueing algorithm: https://en.wikipedia.org/wiki/Fair_queuing.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class FairShareWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements = {
    runTime: {
      aggregate: true,
      average: true,
      median: false
    },
    waitTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    elu: {
      aggregate: true,
      average: true,
      median: false
    }
  }

  /**
   * Workers' virtual task end execution timestamp.
   */
  private workersVirtualTaskEndTimestamp: number[] = []

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
  }

  /** @inheritDoc */
  public reset (): boolean {
    this.workersVirtualTaskEndTimestamp = []
    return true
  }

  /** @inheritDoc */
  public update (workerNodeKey: number): boolean {
    this.computeWorkerVirtualTaskEndTimestamp(workerNodeKey)
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    let minWorkerVirtualTaskEndTimestamp = Infinity
    for (const [workerNodeKey] of this.pool.workerNodes.entries()) {
      if (this.workersVirtualTaskEndTimestamp[workerNodeKey] == null) {
        this.computeWorkerVirtualTaskEndTimestamp(workerNodeKey)
      }
      const workerVirtualTaskEndTimestamp =
        this.workersVirtualTaskEndTimestamp[workerNodeKey]
      if (workerVirtualTaskEndTimestamp < minWorkerVirtualTaskEndTimestamp) {
        minWorkerVirtualTaskEndTimestamp = workerVirtualTaskEndTimestamp
        this.nextWorkerNodeId = workerNodeKey
      }
    }
    return this.nextWorkerNodeId
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    this.workersVirtualTaskEndTimestamp.splice(workerNodeKey, 1)
    return true
  }

  /**
   * Computes the worker node key virtual task end timestamp.
   *
   * @param workerNodeKey - The worker node key.
   */
  private computeWorkerVirtualTaskEndTimestamp (workerNodeKey: number): void {
    this.workersVirtualTaskEndTimestamp[workerNodeKey] =
      this.getWorkerVirtualTaskEndTimestamp(
        workerNodeKey,
        this.getWorkerVirtualTaskStartTimestamp(workerNodeKey)
      )
  }

  private getWorkerVirtualTaskEndTimestamp (
    workerNodeKey: number,
    workerVirtualTaskStartTimestamp: number
  ): number {
    const workerTaskRunTime =
      this.opts.measurement === Measurements.elu
        ? this.getWorkerTaskElu(workerNodeKey)
        : this.getWorkerTaskRunTime(workerNodeKey)
    return workerVirtualTaskStartTimestamp + workerTaskRunTime
  }

  private getWorkerVirtualTaskStartTimestamp (workerNodeKey: number): number {
    return Math.max(
      performance.now(),
      this.workersVirtualTaskEndTimestamp[workerNodeKey] ?? -Infinity
    )
  }
}
