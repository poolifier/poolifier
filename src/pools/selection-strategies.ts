import type { JSONValue, MessageValue } from '../utility-types'
import { isKillBehavior, KillBehaviors } from '../worker/worker-options'
import type { AbstractPool, IWorker } from './abstract-pool'

/**
 * Result of the round robin selection function.
 *
 * @template Type of the chosen element.
 */
export interface RoundRobinSelectionResult<Element> {
  /** The element that was chosen. */
  chosenElement: Element
  /** The next calculated index. */
  nextIndex: number
}

/**
 * Selects the next element in a round robin selection based on the given index.
 *
 * @template Element Type of the element.
 * @param elements An array of elements.
 * @param nextIndex The next calculated index.
 * @returns The chosen element together with the next calculated index.
 */
export function roundRobinSelection<Element> (
  elements: readonly Element[],
  nextIndex: number
): RoundRobinSelectionResult<Element> {
  const chosenElement = elements[nextIndex]
  nextIndex = elements.length - 1 === nextIndex ? 0 : nextIndex + 1
  return { chosenElement, nextIndex }
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
export function findFreeWorkerBasedOnTasks<Worker> (
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
 * @param tasks `tasks`.
 * @param workers `workers`.
 * @param max `max`.
 * @param emitter `emitter`.
 * @param nextWorkerIndex `nextWorkerIndex`.
 * @param nextIndexCallback `nextIndexCallback`.
 * @param createAndSetupWorker `createAndSetupWorker` bounded function.
 * @param registerWorkerMessageListener `registerWorkerMessageListener` bounded function.
 * @param sendToWorker `sendToWorker` bounded function.
 * @param destroyWorker `destroyWorker` bounded function.
 * @returns The chosen one.
 */
export function dynamicallyChooseWorker<
  Worker extends IWorker,
  Data extends JSONValue = JSONValue
> (
  tasks: Map<Worker, number>,
  workers: Worker[],
  max: number,
  emitter: AbstractPool<Worker>['emitter'],
  nextWorkerIndex: number,
  nextIndexCallback: (nextIndex: number) => void,
  createAndSetupWorker: () => Worker,
  registerWorkerMessageListener: (
    worker: Worker,
    listener: (message: MessageValue<Data, unknown>) => void
  ) => void,
  sendToWorker: (worker: Worker, message: MessageValue<Data, unknown>) => void,
  destroyWorker: (worker: Worker) => void | Promise<void>
): Worker {
  const freeWorker = findFreeWorkerBasedOnTasks(tasks)
  if (freeWorker) {
    return freeWorker
  }

  if (workers.length === max) {
    emitter.emit('FullPool')
    const { chosenElement, nextIndex } = roundRobinSelection(
      workers,
      nextWorkerIndex
    )
    nextIndexCallback(nextIndex)
    return chosenElement
  }

  // All workers are busy, create a new worker
  const workerCreated = createAndSetupWorker()
  registerWorkerMessageListener(workerCreated, message => {
    const tasksInProgress = tasks.get(workerCreated)
    if (
      isKillBehavior(KillBehaviors.HARD, message.kill) ||
      tasksInProgress === 0
    ) {
      // Kill received from the worker, means that no new tasks are submitted to that worker for a while ( > maxInactiveTime)
      sendToWorker(workerCreated, { kill: 1 })
      void destroyWorker(workerCreated)
    }
  })
  return workerCreated
}
