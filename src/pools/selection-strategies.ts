import { isKillBehavior, KillBehaviors } from '../worker/worker-options'
import type { IWorker } from './abstract-pool'
import type { IPoolInternal } from './pool-internal'

/**
 * Choice strategy callback type.
 */
export type WorkerChoiceStrategy<Worker extends IWorker, Data, Response> = (
  poolReference: IPoolInternal<Worker, Data, Response>,
  ...args: unknown[]
) => Worker

/**
 * Selects the next worker in a round robin selection based on the given index.
 *
 * @param poolReference Reference to the pool instance.
 * @returns The chosen worker.
 */
export function roundRobinChooseWorker<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> (poolReference: IPoolInternal<Worker, Data, Response>): Worker {
  const chosenWorker = poolReference.workers[poolReference.nextWorkerIndex]
  poolReference.nextWorkerIndex =
    poolReference.workers.length - 1 === poolReference.nextWorkerIndex
      ? 0
      : poolReference.nextWorkerIndex + 1
  return chosenWorker
}

/**
 * Find a free worker based on number of tasks the worker has applied.
 *
 * If a worker was found that has `0` tasks, it is detected as free and will be returned.
 *
 * If no free worker was found, `null` will be returned.
 *
 * @param tasks A map of tasks.
 * @returns A free worker if there was one, otherwise `null`.
 */
function findFreeWorkerBasedOnTasks<Worker> (
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
 * Dynamically choose a worker.
 *
 * It will first check for and return an idle worker.
 * If all workers are busy, then it will try to create a new one up to the `max` worker count.
 * If the max worker count is reached, the emitter will emit a `FullPool` event and it will fall back to using a round robin algorithm to distribute the load.
 *
 * @param poolReference Reference to the pool instance.
 * @param defaultChoiceCallback `defaultChoiceCallback` function.
 * @param createAndSetupWorker `createAndSetupWorker` bounded function.
 * @param registerWorkerMessageListener `registerWorkerMessageListener` bounded function.
 * @param destroyWorker `destroyWorker` bounded function.
 * @returns The chosen one.
 */
export function dynamicallyChooseWorker<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> (
  poolReference: IPoolInternal<Worker, Data, Response>,
  defaultChoiceCallback: IPoolInternal<
    Worker,
    Data,
    Response
  >['workerChoiceCallback'],
  createAndSetupWorker: IPoolInternal<
    Worker,
    Data,
    Response
  >['createAndSetupWorker'],
  registerWorkerMessageListener: IPoolInternal<
    Worker,
    Data,
    Response
  >['registerWorkerMessageListener'],
  destroyWorker: IPoolInternal<Worker, Data, Response>['destroyWorker']
): Worker {
  const freeWorker = findFreeWorkerBasedOnTasks(poolReference.tasks)
  if (freeWorker) {
    return freeWorker
  }

  if (poolReference.workers.length === poolReference.max) {
    poolReference.emitter.emit('FullPool')
    return defaultChoiceCallback(poolReference)
  }

  // All workers are busy, create a new worker
  const workerCreated = createAndSetupWorker()
  registerWorkerMessageListener(workerCreated, message => {
    const tasksInProgress = poolReference.tasks.get(workerCreated)
    if (
      isKillBehavior(KillBehaviors.HARD, message.kill) ||
      tasksInProgress === 0
    ) {
      // Kill received from the worker, means that no new tasks are submitted to that worker for a while ( > maxInactiveTime)
      void destroyWorker(workerCreated)
    }
  })
  return workerCreated
}
