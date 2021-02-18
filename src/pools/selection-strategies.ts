import type { JSONValue } from '../utility-types'
import { isKillBehavior, KillBehaviors } from '../worker/worker-options'
import type { IWorker } from './abstract-pool'
import type { IDynamicPool } from './dynamic-pool'
import { IPool } from './pool'

/**
 * Selects the next worker in a round robin selection based on the given index.
 *
 * @param poolReference Reference to the pool instance.
 * @returns The chosen worker.
 */
export function roundRobinChooseWorker<
  Worker extends IWorker,
  Data extends JSONValue = JSONValue,
  Response extends JSONValue = JSONValue
> (poolReference: IPool<Worker, Data, Response>): Worker {
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
 * @param poolReference Reference to the pool instance.
 * @param createAndSetupWorker `createAndSetupWorker` bounded function.
 * @param registerWorkerMessageListener `registerWorkerMessageListener` bounded function.
 * @param destroyWorker `destroyWorker` bounded function.
 * @returns The chosen worker.
 */
export function dynamicallyChooseWorker<
  Worker extends IWorker,
  Data extends JSONValue = JSONValue,
  Response extends JSONValue = JSONValue
> (
  poolReference: IDynamicPool<Worker, Data, Response>,
  createAndSetupWorker: IDynamicPool<
    Worker,
    Data,
    Response
  >['createAndSetupWorker'],
  registerWorkerMessageListener: IDynamicPool<
    Worker,
    Data,
    Response
  >['registerWorkerMessageListener'],
  destroyWorker: IDynamicPool<Worker, Data, Response>['destroyWorker']
): Worker {
  const freeWorker = findFreeWorkerBasedOnTasks(poolReference.tasks)
  if (freeWorker) {
    return freeWorker
  }

  if (poolReference.workers.length === poolReference.max) {
    poolReference.emitter.emit('FullPool')
    return roundRobinChooseWorker<Worker, Data, Response>(poolReference)
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
