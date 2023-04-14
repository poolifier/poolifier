import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the less used worker.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export class LessUsedWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    super(pool, opts)
    this.checkOptions(opts)
  }

  /** @inheritDoc */
  public reset (): boolean {
    return true
  }

  /** @inheritDoc */
  public choose (): number {
    const freeWorkerNodeKey = this.pool.findFreeWorkerNodeKey()
    if (freeWorkerNodeKey !== -1) {
      return freeWorkerNodeKey
    }
    let minNumberOfTasks = Infinity
    let lessUsedWorkerNodeKey!: number
    for (const [index, workerNode] of this.pool.workerNodes.entries()) {
      const tasksUsage = workerNode.tasksUsage
      const workerTasks = tasksUsage.run + tasksUsage.running
      if (workerTasks === 0) {
        return index
      } else if (workerTasks < minNumberOfTasks) {
        minNumberOfTasks = workerTasks
        lessUsedWorkerNodeKey = index
      }
    }
    return lessUsedWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    return true
  }
}
