import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../../utils.js'
import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.js'
import type {
  IWorkerChoiceStrategy,
  InternalWorkerChoiceStrategyOptions,
  TaskStatisticsRequirements
} from './selection-strategies-types.js'

/**
 * Selects the least busy worker.
 *
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
      median: false
    },
    waitTime: {
      aggregate: true,
      average: false,
      median: false
    },
    elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS
  }

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: InternalWorkerChoiceStrategyOptions
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
  public choose (): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.nextWorkerNodeKey = this.leastBusyNextWorkerNodeKey()
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }

  private leastBusyNextWorkerNodeKey (): number | undefined {
    return this.pool.workerNodes.reduce(
      (minWorkerNodeKey, workerNode, workerNodeKey, workerNodes) => {
        return this.isWorkerNodeReady(workerNodeKey) &&
          (workerNode.usage.runTime.aggregate ?? 0) +
            (workerNode.usage.waitTime.aggregate ?? 0) <
            (workerNodes[minWorkerNodeKey].usage.runTime.aggregate ?? 0) +
              (workerNodes[minWorkerNodeKey].usage.waitTime.aggregate ?? 0)
          ? workerNodeKey
          : minWorkerNodeKey
      },
      0
    )
  }
}
