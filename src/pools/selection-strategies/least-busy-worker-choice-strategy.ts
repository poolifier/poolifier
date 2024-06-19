import type { IPool } from '../pool.js'
import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../utils.js'
import type { IWorker } from '../worker.js'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.js'
import type {
  IWorkerChoiceStrategy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategyOptions,
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
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements = {
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
    elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  }

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
  }

  /** @inheritDoc */
  public reset (): boolean {
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  /** @inheritDoc */
  public choose (workerNodes?: number[]): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.nextWorkerNodeKey = this.leastBusyNextWorkerNodeKey(workerNodes)
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }

  private leastBusyNextWorkerNodeKey (
    workerNodeKeys?: number[]
  ): number | undefined {
    workerNodeKeys = this.checkWorkerNodes(workerNodeKeys)
    if (workerNodeKeys.length === 1) {
      return workerNodeKeys[0]
    }
    return this.pool.workerNodes.reduce(
      (minWorkerNodeKey, workerNode, workerNodeKey, workerNodes) => {
        return this.isWorkerNodeReady(workerNodeKey) &&
          workerNodeKeys.includes(workerNodeKey) &&
          (workerNode.usage.waitTime.aggregate ?? 0) +
            (workerNode.usage.runTime.aggregate ?? 0) <
            (workerNodes[minWorkerNodeKey].usage.waitTime.aggregate ?? 0) +
              (workerNodes[minWorkerNodeKey].usage.runTime.aggregate ?? 0)
          ? workerNodeKey
          : minWorkerNodeKey
      },
      0
    )
  }
}
