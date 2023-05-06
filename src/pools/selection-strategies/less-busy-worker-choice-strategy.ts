import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  RequiredStatistics,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the less busy worker.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export class LessBusyWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly requiredStatistics: RequiredStatistics = {
    runTime: true,
    avgRunTime: false,
    medRunTime: false
  }

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    super(pool, opts)
    this.checkOptions(this.opts)
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
  public choose (): number {
    const freeWorkerNodeKey = this.findFreeWorkerNodeKey()
    if (freeWorkerNodeKey !== -1) {
      return freeWorkerNodeKey
    }
    let minRunTime = Infinity
    let lessBusyWorkerNodeKey!: number
    for (const [workerNodeKey, workerNode] of this.pool.workerNodes.entries()) {
      const workerRunTime = workerNode.tasksUsage.runTime
      if (workerRunTime === 0) {
        return workerNodeKey
      } else if (workerRunTime < minRunTime) {
        minRunTime = workerRunTime
        lessBusyWorkerNodeKey = workerNodeKey
      }
    }
    return lessBusyWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }
}
