import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'

import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../utils.js'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.js'
import {
  type IWorkerChoiceStrategy,
  type TaskStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'

/**
 * Selects the least busy worker.
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class LeastBusyWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly name: WorkerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY

  /** @inheritDoc */
  public override readonly taskStatisticsRequirements: TaskStatisticsRequirements =
    Object.freeze({
      elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
      runTime: {
        aggregate: true,
        average: false,
        median: false,
      },
      waitTime: {
        aggregate: true,
        average: false,
        median: false,
      },
    })

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
  }

  /** @inheritDoc */
  public choose (): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.nextWorkerNodeKey = this.leastBusyNextWorkerNodeKey()
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }

  /** @inheritDoc */
  public reset (): boolean {
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  private leastBusyNextWorkerNodeKey (): number | undefined {
    const chosenWorkerNodeKey = this.pool.workerNodes.reduce(
      (minWorkerNodeKey: number, workerNode, workerNodeKey, workerNodes) => {
        if (!this.isWorkerNodeReady(workerNodeKey)) {
          return minWorkerNodeKey
        }
        if (minWorkerNodeKey === -1) {
          return workerNodeKey
        }
        return (workerNode.usage.waitTime.aggregate ?? 0) +
          (workerNode.usage.runTime.aggregate ?? 0) <
          (workerNodes[minWorkerNodeKey].usage.waitTime.aggregate ?? 0) +
            (workerNodes[minWorkerNodeKey].usage.runTime.aggregate ?? 0)
          ? workerNodeKey
          : minWorkerNodeKey
      },
      -1
    )
    return chosenWorkerNodeKey === -1 ? undefined : chosenWorkerNodeKey
  }
}
