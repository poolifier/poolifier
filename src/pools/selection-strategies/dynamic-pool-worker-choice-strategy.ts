import type { IWorker } from '../abstract-pool'
import type { IPoolInternal } from '../pool-internal'
import type {
  IWorkerChoiceStrategy,
  WorkerChoiceStrategy
} from './selection-strategies-types'
import { WorkerChoiceStrategies } from './selection-strategies-types'
import { SelectionStrategiesUtils } from './selection-strategies-utils'

/**
 * Dynamically choose a worker.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export class DynamicPoolWorkerChoiceStrategy<
  Worker extends IWorker,
  Data,
  Response
> implements IWorkerChoiceStrategy<Worker> {
  private workerChoiceStrategy: IWorkerChoiceStrategy<Worker>

  /**
   * Constructs a worker choice strategy for dynamical pools.
   *
   * @param pool The pool instance.
   * @param createDynamicallyWorkerCallback The worker creation callback for dynamic pool.
   * @param workerChoiceStrategy The worker choice strategy when the pull is busy.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>,
    private createDynamicallyWorkerCallback: () => Worker,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ) {
    this.workerChoiceStrategy = SelectionStrategiesUtils.getWorkerChoiceStrategy(
      this.pool,
      workerChoiceStrategy
    )
  }

  /** @inheritdoc */
  public choose (): Worker {
    const freeWorkerTasksUsageMapEntry = this.pool.findFreeWorkerTasksUsageMapEntry()
    if (freeWorkerTasksUsageMapEntry) {
      return freeWorkerTasksUsageMapEntry[0]
    }

    if (this.pool.busy) {
      return this.workerChoiceStrategy.choose()
    }

    // All workers are busy, create a new worker
    return this.createDynamicallyWorkerCallback()
  }
}
