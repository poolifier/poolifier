import { DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS } from '../../utils'
import type { IPool } from '../pool'
import type { IWorker } from '../worker'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  TaskStatistics,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the worker with the least ELU.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be serializable data.
 * @typeParam Response - Type of execution response. This can only be serializable data.
 */
export class LeastEluWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly taskStatistics: TaskStatistics = {
    runTime: false,
    avgRunTime: true,
    medRunTime: false,
    waitTime: false,
    avgWaitTime: false,
    medWaitTime: false,
    elu: true
  }

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    super(pool, opts)
    this.setTaskStatistics(this.opts)
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
    let minTasksElu = Infinity
    let leastEluWorkerNodeKey!: number
    for (const [workerNodeKey, workerNode] of this.pool.workerNodes.entries()) {
      const tasksUsage = workerNode.tasksUsage
      const tasksElu = tasksUsage.elu?.utilization ?? 0
      if (tasksElu === 0) {
        return workerNodeKey
      } else if (tasksElu < minTasksElu) {
        minTasksElu = tasksElu
        leastEluWorkerNodeKey = workerNodeKey
      }
    }
    return leastEluWorkerNodeKey
  }

  /** @inheritDoc */
  public remove (): boolean {
    return true
  }
}
