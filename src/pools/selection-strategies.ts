import type { IWorker } from './abstract-pool'
import type { IPoolInternal } from './pool-internal'

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
  LESS_RECENTLY_USED: 'LESS_RECENTLY_USED'
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
    const isPoolDynamic = this.pool.dynamic
    let minNumberOfTasks = Infinity
    // A worker is always found because it picks the one with fewer tasks
    let lessRecentlyUsedWorker!: Worker
    for (const [worker, numberOfTasks] of this.pool.tasks) {
      if (!isPoolDynamic && numberOfTasks === 0) {
        return worker
      } else if (numberOfTasks < minNumberOfTasks) {
        minNumberOfTasks = numberOfTasks
        lessRecentlyUsedWorker = worker
      }
    }
    return lessRecentlyUsedWorker
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
   * @param workerChoiceStrategy The worker choice strategy when the pull is full.
   * @param createDynamicallyWorkerCallback The worker creation callback for dynamic pool.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN,
    private createDynamicallyWorkerCallback: () => Worker
  ) {
    this.workerChoiceStrategy = SelectionStrategiesUtils.getWorkerChoiceStrategy(
      this.pool,
      workerChoiceStrategy
    )
  }

  /** @inheritdoc */
  public choose (): Worker {
    const freeWorker = SelectionStrategiesUtils.findFreeWorkerBasedOnTasks(
      this.pool.tasks
    )
    if (freeWorker) {
      return freeWorker
    }

    if (this.pool.workers.length === this.pool.max) {
      this.pool.emitter.emit('FullPool')
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
   * @param workerChoiceStrategy The worker choice strategy.
   * @param createDynamicallyWorkerCallback The worker creation callback for dynamic pool.
   */
  public constructor (
    private readonly pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN,
    private createDynamicallyWorkerCallback: () => Worker
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
    if (this.pool.dynamic) {
      return new DynamicPoolWorkerChoiceStrategy(
        this.pool,
        workerChoiceStrategy,
        this.createDynamicallyWorkerCallback
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
 * Worker selection strategies helpers.
 */
class SelectionStrategiesUtils {
  /**
   * Find a free worker based on number of tasks the worker has applied.
   *
   * If a worker was found that has `0` tasks, it is detected as free and will be returned.
   *
   * If no free worker was found, `null` will be returned.
   *
   * @param tasks The pool worker tasks map.
   * @returns A free worker if there was one, otherwise `null`.
   */
  public static findFreeWorkerBasedOnTasks<Worker extends IWorker> (
    tasks: Map<Worker, number>
  ): Worker | null {
    for (const [worker, numberOfTasks] of tasks) {
      if (numberOfTasks === 0) {
        // A worker is free, use it
        return worker
      }
    }
    return null
  }

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
      default:
        throw new Error(
          `Worker choice strategy '${workerChoiceStrategy}' not found`
        )
    }
  }
}
