import type { IWorker } from './abstract-pool'
import type { IPoolInternal } from './pool-internal'
import { PoolType } from './pool-internal'

/**
 * Enumeration of worker choice strategies.
 */
export const WorkerChoiceStrategies = Object.freeze({
  /**
   * Round robin worker selection strategy.
   */
  ROUND_ROBIN: 'ROUND_ROBIN',
  /**
   * Less recently used worker selection strategy.
   */
  LESS_RECENTLY_USED: 'LESS_RECENTLY_USED',
  /**
   * Fair share worker selection strategy.
   */
  FAIR_SHARE: 'FAIR_SHARE'
} as const)

/**
 * Worker choice strategy.
 */
export type WorkerChoiceStrategy = keyof typeof WorkerChoiceStrategies

/**
 * Worker choice strategy interface.
 *
 * @template Worker Type of worker which manages the strategy.
 */
interface IWorkerChoiceStrategy<Worker extends IWorker> {
  /**
   * Choose a worker in the pool.
   */
  choose(): Worker
}

/**
 * Selects the next worker in a round robin fashion.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
class RoundRobinWorkerChoiceStrategy<Worker extends IWorker, Data, Response>
  implements IWorkerChoiceStrategy<Worker> {
  /**
   * Index for the next worker.
   */
  private nextWorkerIndex: number = 0

  /**
   * Constructs a worker choice strategy that selects in a round robin fashion.
   *
   * @param pool The pool instance.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>
  ) {}

  /** @inheritdoc */
  public choose (): Worker {
    const chosenWorker = this.pool.workers[this.nextWorkerIndex]
    this.nextWorkerIndex =
      this.pool.workers.length - 1 === this.nextWorkerIndex
        ? 0
        : this.nextWorkerIndex + 1
    return chosenWorker
  }
}

/**
 * Selects the less recently used worker.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
class LessRecentlyUsedWorkerChoiceStrategy<
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

/**
 * Selects the next worker with a fair share tasks scheduling algorithm.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
class FairShareChoiceStrategy<Worker extends IWorker, Data, Response>
  implements IWorkerChoiceStrategy<Worker> {
  /**
   *  Worker last virtual task execution end timestamp.
   */
  private workerLastVirtualTaskFinishTimestamp: Map<Worker, number>

  /**
   * Constructs a worker choice strategy that selects based a fair share tasks scheduling algorithm.
   *
   * @param pool The pool instance.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>
  ) {
    this.workerLastVirtualTaskFinishTimestamp = new Map<Worker, number>()
  }

  /** @inheritdoc */
  public choose (): Worker {
    let minWorkerVirtualTaskFinishPredictedTimestamp = Infinity
    let chosenWorker!: Worker
    for (const worker of this.pool.workerTasksUsage.keys()) {
      const workerLastVirtualTaskFinishPredictedTimestamp = this.getWorkerLastVirtualTaskFinishPredictedTimestamp(
        worker
      )
      if (
        workerLastVirtualTaskFinishPredictedTimestamp <
        minWorkerVirtualTaskFinishPredictedTimestamp
      ) {
        minWorkerVirtualTaskFinishPredictedTimestamp = workerLastVirtualTaskFinishPredictedTimestamp
        chosenWorker = worker
      }
    }
    this.setWorkerLastVirtualTaskFinishTimestamp(
      chosenWorker,
      minWorkerVirtualTaskFinishPredictedTimestamp
    )
    return chosenWorker
  }

  /**
   * Get the worker last virtual task start timestamp.
   *
   * @param worker The worker.
   * @returns The worker last virtual task start timestamp.
   */
  private getWorkerLastVirtualTaskStartTimestamp (worker: Worker): number {
    return Math.max(
      Date.now(),
      this.workerLastVirtualTaskFinishTimestamp.get(worker) ?? 0
    )
  }

  private getWorkerLastVirtualTaskFinishPredictedTimestamp (
    worker: Worker
  ): number {
    const workerVirtualTaskStartTimestamp = this.getWorkerLastVirtualTaskStartTimestamp(
      worker
    )
    const workerAvgRunTime =
      this.pool.workerTasksUsage.get(worker)?.avgRunTime ?? 0
    return workerAvgRunTime + workerVirtualTaskStartTimestamp
  }

  private setWorkerLastVirtualTaskFinishTimestamp (
    worker: Worker,
    lastVirtualTaskFinishTimestamp: number
  ): void {
    this.workerLastVirtualTaskFinishTimestamp.set(
      worker,
      lastVirtualTaskFinishTimestamp
    )
  }
}

/**
 * Dynamically choose a worker.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
class DynamicPoolWorkerChoiceStrategy<Worker extends IWorker, Data, Response>
  implements IWorkerChoiceStrategy<Worker> {
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

/**
 * The worker choice strategy context.
 *
 * @template Worker Type of worker.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
export class WorkerChoiceStrategyContext<
  Worker extends IWorker,
  Data,
  Response
> {
  // Will be set by setter in constructor
  private workerChoiceStrategy!: IWorkerChoiceStrategy<Worker>

  /**
   * Worker choice strategy context constructor.
   *
   * @param pool The pool instance.
   * @param createDynamicallyWorkerCallback The worker creation callback for dynamic pool.
   * @param workerChoiceStrategy The worker choice strategy.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>,
    private createDynamicallyWorkerCallback: () => Worker,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ) {
    this.setWorkerChoiceStrategy(workerChoiceStrategy)
  }

  /**
   * Get the worker choice strategy instance specific to the pool type.
   *
   * @param workerChoiceStrategy The worker choice strategy.
   * @returns The worker choice strategy instance for the pool type.
   */
  private getPoolWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ): IWorkerChoiceStrategy<Worker> {
    if (this.pool.type === PoolType.DYNAMIC) {
      return new DynamicPoolWorkerChoiceStrategy(
        this.pool,
        this.createDynamicallyWorkerCallback,
        workerChoiceStrategy
      )
    }
    return SelectionStrategiesUtils.getWorkerChoiceStrategy(
      this.pool,
      workerChoiceStrategy
    )
  }

  /**
   * Set the worker choice strategy to use in the context.
   *
   * @param workerChoiceStrategy The worker choice strategy to set.
   */
  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy
  ): void {
    this.workerChoiceStrategy = this.getPoolWorkerChoiceStrategy(
      workerChoiceStrategy
    )
  }

  /**
   * Choose a worker with the underlying selection strategy.
   *
   * @returns The chosen one.
   */
  public execute (): Worker {
    return this.workerChoiceStrategy.choose()
  }
}

/**
 * Worker selection strategies helpers class.
 */
class SelectionStrategiesUtils {
  /**
   * Get the worker choice strategy instance.
   *
   * @param pool The pool instance.
   * @param workerChoiceStrategy The worker choice strategy.
   * @returns The worker choice strategy instance.
   */
  public static getWorkerChoiceStrategy<
    Worker extends IWorker,
    Data,
    Response
  > (
    pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
  ): IWorkerChoiceStrategy<Worker> {
    switch (workerChoiceStrategy) {
      case WorkerChoiceStrategies.ROUND_ROBIN:
        return new RoundRobinWorkerChoiceStrategy(pool)
      case WorkerChoiceStrategies.LESS_RECENTLY_USED:
        return new LessRecentlyUsedWorkerChoiceStrategy(pool)
      case WorkerChoiceStrategies.FAIR_SHARE:
        return new FairShareChoiceStrategy(pool)
      default:
        throw new Error(
          `Worker choice strategy '${workerChoiceStrategy}' not found`
        )
    }
  }
}
