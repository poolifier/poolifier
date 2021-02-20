import { isKillBehavior, KillBehaviors } from '../worker/worker-options'
import type { IWorker } from './abstract-pool'
import type { IPoolInternal } from './pool-internal'

/**
 * Worker choice strategies string list.
 */
export enum WorkerChoiceStrategy {
  ROUND_ROBIN = 'RoundRobin',
  DYNAMIC = 'Dynamic'
}

interface IWorkerChoiceStrategy<Worker extends IWorker> {
  choose(): Worker
}

/**
 * Selects the next worker in a round robin selection based on the given index.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
class RoundRobinWorkerChoiceStrategy<Worker extends IWorker, Data, Response>
  implements IWorkerChoiceStrategy<Worker> {
  /**
   * @param pool The pool instance.
   */
  constructor (private pool: IPoolInternal<Worker, Data, Response>) {
    this.pool = pool
  }

  public choose () {
    const chosenWorker = this.pool.workers[this.pool.nextWorkerIndex]
    this.pool.nextWorkerIndex =
      this.pool.workers.length - 1 === this.pool.nextWorkerIndex
        ? 0
        : this.pool.nextWorkerIndex + 1
    return chosenWorker
  }
}

/**
 * Dynamically choose a worker.
 *
 * @template Worker Type of worker which manages this pool.
 * @template Data Type of data sent to the worker. This can only be serializable data.
 * @template Response Type of response of execution. This can only be serializable data.
 */
class DynamicWorkerChoiceStrategy<Worker extends IWorker, Data, Response>
  implements IWorkerChoiceStrategy<Worker> {
  private workerChoiceStrategy: IWorkerChoiceStrategy<Worker>

  /**
   * @param pool The pool instance.
   * @param workerChoiceStrategy The default worker choice strategy.
   */
  constructor (
    private pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy
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

function getWorkerChoiceStrategy<Worker extends IWorker, Data, Response> (
  pool: IPoolInternal<Worker, Data, Response>,
  workerChoiceStrategy: WorkerChoiceStrategy
): IWorkerChoiceStrategy<Worker> {
  switch (workerChoiceStrategy) {
    case WorkerChoiceStrategy.ROUND_ROBIN:
      return new RoundRobinWorkerChoiceStrategy<Worker, Data, Response>(pool)
    case WorkerChoiceStrategy.DYNAMIC:
      return new DynamicWorkerChoiceStrategy<Worker, Data, Response>(
        pool,
        WorkerChoiceStrategy.ROUND_ROBIN
      )
  }
}

export class WorkerChoiceStrategyContext<
  Worker extends IWorker,
  Data,
  Response
> {
  private workerChoiceStrategy: IWorkerChoiceStrategy<
    Worker
  > = {} as IWorkerChoiceStrategy<Worker>

  constructor (
    private pool: IPoolInternal<Worker, Data, Response>,
    workerChoiceStrategy: WorkerChoiceStrategy = WorkerChoiceStrategy.ROUND_ROBIN
  ) {
    this.setWorkerChoiceStrategy(workerChoiceStrategy)
  }

  setWorkerChoiceStrategy (workerChoiceStrategy: WorkerChoiceStrategy): void {
    this.workerChoiceStrategy = getWorkerChoiceStrategy(
      this.pool,
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
