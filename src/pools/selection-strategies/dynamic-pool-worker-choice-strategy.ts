import type { IPoolInternal } from '../pool-internal'
import type { IPoolWorker } from '../pool-worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  WorkerChoiceStrategy
} from './selection-strategies-types'
import { WorkerChoiceStrategies } from './selection-strategies-types'
import { getWorkerChoiceStrategy } from './selection-strategies-utils'

/**
 * Selects the next worker for dynamic pool.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export class DynamicPoolWorkerChoiceStrategy<
  Worker extends IPoolWorker,
  Data,
  Response
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response> {
  private readonly workerChoiceStrategy: IWorkerChoiceStrategy<Worker>

  /**
   * Constructs a worker choice strategy for dynamic pool.
   *
   * @param pool The pool instance.
   * @param createDynamicallyWorkerCallback The worker creation callback for dynamic pool.
   * @param workerChoiceStrategy The worker choice strategy when the pull is busy.
   */
  public constructor (
    pool: IPoolInternal<Worker, Data, Response>,
    private readonly createDynamicallyWorkerCallback: () => Worker,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ) {
    super(pool)
    this.workerChoiceStrategy = getWorkerChoiceStrategy(
      this.pool,
      workerChoiceStrategy
    )
    this.requiredStatistics = this.workerChoiceStrategy.requiredStatistics
  }

  /** @inheritDoc */
  public reset (): boolean {
    return this.workerChoiceStrategy.reset()
  }

  /** @inheritDoc */
  public choose (): Worker {
    const freeWorker = this.pool.findFreeWorker()
    if (freeWorker !== false) {
      return freeWorker
    }

    if (this.pool.busy) {
      return this.workerChoiceStrategy.choose()
    }

    // All workers are busy, create a new worker
    return this.createDynamicallyWorkerCallback()
  }
}
