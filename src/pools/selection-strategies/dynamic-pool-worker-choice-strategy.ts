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
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of response of execution. This can only be serializable data.
 */
export class DynamicPoolWorkerChoiceStrategy<
    Worker extends IPoolWorker,
    Data,
    Response
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  private readonly workerChoiceStrategy: IWorkerChoiceStrategy

  /**
   * Constructs a worker choice strategy for dynamic pool.
   *
   * @param pool - The pool instance.
   * @param createWorkerCallback - The worker creation callback for dynamic pool.
   * @param workerChoiceStrategy - The worker choice strategy when the pool is busy.
   */
  public constructor (
    pool: IPoolInternal<Worker, Data, Response>,
    private readonly createWorkerCallback: () => number,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ) {
    super(pool)
    this.workerChoiceStrategy = getWorkerChoiceStrategy(
      this.pool,
      workerChoiceStrategy
    )
    this.requiredStatistics = this.workerChoiceStrategy.requiredStatistics
  }

  /** {@inheritDoc} */
  public reset (): boolean {
    return this.workerChoiceStrategy.reset()
  }

  /** {@inheritDoc} */
  public choose (): number {
    const freeWorkerKey = this.pool.findFreeWorkerKey()
    if (freeWorkerKey !== -1) {
      return freeWorkerKey
    }

    if (this.pool.busy) {
      return this.workerChoiceStrategy.choose()
    }

    // All workers are busy, create a new worker
    return this.createWorkerCallback()
  }

  /** {@inheritDoc} */
  public remove (workerKey: number): boolean {
    return this.workerChoiceStrategy.remove(workerKey)
  }
}
