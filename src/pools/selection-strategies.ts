export interface RoundRobinSelectionResult<Element> {
  chosenElement: Element
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
