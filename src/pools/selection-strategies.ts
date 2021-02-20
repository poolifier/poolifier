import { isKillBehavior, KillBehaviors } from '../worker/worker-options'
import type { IWorker } from './abstract-pool'
import type { IPoolInternal } from './pool-internal'

/**
 * Worker choice strategies string list.
 */
export enum WorkerChoiceStrategy {
  ROUND_ROBIN = 'RoundRobin',
  LESS_USED = 'LessUsed'
}

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
   * @param pool The pool instance.
   */
  constructor (private pool: IPoolInternal<Worker, Data, Response>) {
    this.pool = pool
  }

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
 * Selects the less used worker.
 *
 * @template Worker Type of worker which manages the strategy.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
class LessUsedWorkerChoiceStrategy<Worker extends IWorker, Data, Response>
  implements IWorkerChoiceStrategy<Worker> {
  /**
   * @param pool The pool instance.
   */
  constructor (private pool: IPoolInternal<Worker, Data, Response>) {
    this.pool = pool
  }

  /** @inheritdoc */
  public choose (): Worker {
    let minNumberOfTasks = Infinity
    let lessUsedWorker: Worker = {} as Worker
    for (const [worker, numberOfTasks] of this.pool.tasks) {
      if (numberOfTasks < minNumberOfTasks) {
        minNumberOfTasks = numberOfTasks
        lessUsedWorker = worker
        if (numberOfTasks === 0) break
      }
    }
    return lessUsedWorker
  }
}

/**
 * Get the worker choice strategy instance.
 *
 * @param pool The pool instance.
 * @param workerChoiceStrategy The worker choice strategy.
 * @returns The worker choice strategy instance.
 */
function getWorkerChoiceStrategy<Worker extends IWorker, Data, Response> (
  pool: IPoolInternal<Worker, Data, Response>,
  workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategy.ROUND_ROBIN
): IWorkerChoiceStrategy<Worker> {
  switch (workerChoiceStrategy) {
    case WorkerChoiceStrategy.ROUND_ROBIN:
      return new RoundRobinWorkerChoiceStrategy<Worker, Data, Response>(pool)
    case WorkerChoiceStrategy.LESS_USED:
      return new LessUsedWorkerChoiceStrategy<Worker, Data, Response>(pool)
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
   * @param pool The pool instance.
   * @param workerChoiceStrategy The worker choice strategy when the pull is full.
   */
  constructor (
    private pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategy.ROUND_ROBIN
  ) {
    this.pool = pool
    this.workerChoiceStrategy = getWorkerChoiceStrategy(
      this.pool,
      workerChoiceStrategy
    )
  }

  /**
   * Find a free worker based on number of tasks the worker has applied.
   *
   * If a worker was found that has `0` tasks, it is detected as free and will be returned.
   *
   * If no free worker was found, `null` will be returned.
   *
   * @returns A free worker if there was one, otherwise `null`.
   */
  private findFreeWorkerBasedOnTasks (): Worker | null {
    for (const [worker, numberOfTasks] of this.pool.tasks) {
      if (numberOfTasks === 0) {
        // A worker is free, use it
        return worker
      }
    }
    return null
  }

  /** @inheritdoc */
  public choose (): Worker {
    const freeWorker = this.findFreeWorkerBasedOnTasks()
    if (freeWorker) {
      return freeWorker
    }

    if (this.pool.workers.length === this.pool.max) {
      this.pool.emitter.emit('FullPool')
      return this.workerChoiceStrategy.choose()
    }

    // All workers are busy, create a new worker
    const workerCreated = this.pool.createAndSetupWorker()
    this.pool.registerWorkerMessageListener(workerCreated, message => {
      const tasksInProgress = this.pool.tasks.get(workerCreated)
      if (
        isKillBehavior(KillBehaviors.HARD, message.kill) ||
        tasksInProgress === 0
      ) {
        // Kill received from the worker, means that no new tasks are submitted to that worker for a while ( > maxInactiveTime)
        void this.pool.destroyWorker(workerCreated)
      }
    })
    return workerCreated
  }
}

/**
 * The worker choice strategy context.
 */
export class WorkerChoiceStrategyContext<
  Worker extends IWorker,
  Data,
  Response
> {
  private workerChoiceStrategy: IWorkerChoiceStrategy<
    Worker
  > = {} as IWorkerChoiceStrategy<Worker>

  /**
   * Worker choice strategy context constructor.
   *
   * @param pool The pool instance.
   * @param workerChoiceStrategy The worker choice strategy.
   */
  constructor (
    private pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategy.ROUND_ROBIN
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
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategy.ROUND_ROBIN
  ): IWorkerChoiceStrategy<Worker> {
    if (this.pool.isDynamic()) {
      return new DynamicPoolWorkerChoiceStrategy<Worker, Data, Response>(
        this.pool,
        workerChoiceStrategy
      )
    }
    return getWorkerChoiceStrategy<Worker, Data, Response>(
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
   * @returns The chosen one.
   */
  public execute (): Worker {
    return this.workerChoiceStrategy.choose()
  }
}
