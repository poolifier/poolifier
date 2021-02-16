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
