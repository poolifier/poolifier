import type { IWorker } from '../abstract-pool'
import type { IPoolInternal } from '../pool-internal'
import { PoolType } from '../pool-internal'
import type { IWorkerChoiceStrategy } from './selection-strategies-types'

/**
 * Selects the less recently used worker.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export class LessRecentlyUsedWorkerChoiceStrategy<
  Worker extends IWorker,
  Data,
  Response
> implements IWorkerChoiceStrategy<Worker> {
  /**
   * Constructs a worker choice strategy that selects based on less recently used.
   *
   * @param pool The pool instance.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>
  ) {}

  /** @inheritdoc */
  public choose (): Worker {
    const isPoolDynamic = this.pool.type === PoolType.DYNAMIC
    let minNumberOfRunningTasks = Infinity
    // A worker is always found because it picks the one with fewer tasks
    let lessRecentlyUsedWorker!: Worker
    for (const [worker, tasksUsage] of this.pool.workerTasksUsage) {
      if (!isPoolDynamic && tasksUsage.running === 0) {
        return worker
      } else if (tasksUsage.running < minNumberOfRunningTasks) {
        lessRecentlyUsedWorker = worker
        minNumberOfRunningTasks = tasksUsage.running
      }
    }
    return lessRecentlyUsedWorker
  }
}
