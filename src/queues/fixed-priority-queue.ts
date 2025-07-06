import type { IFixedQueue } from './queue-types.js'

import { AbstractFixedQueue } from './abstract-fixed-queue.js'

/**
 * Fixed priority queue.
 * @typeParam T - Type of fixed priority queue data.
 * @internal
 */
export class FixedPriorityQueue<T>
  extends AbstractFixedQueue<T>
  implements IFixedQueue<T> {
  /** @inheritdoc */
  public enqueue (data: T, priority?: number): number {
    if (this.full()) {
      throw new Error('Fixed priority queue is full')
    }
    priority = priority ?? 0
    let insertionPhysicalIndex = -1
    let currentPhysicalIndex = this.start
    for (let i = 0; i < this.size; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (this.nodeArray[currentPhysicalIndex]!.priority > priority) {
        insertionPhysicalIndex = currentPhysicalIndex
        break
      }
      currentPhysicalIndex++
      if (currentPhysicalIndex === this.capacity) {
        currentPhysicalIndex = 0
      }
    }
    let end = this.start + this.size
    if (end >= this.capacity) {
      end -= this.capacity
    }
    if (insertionPhysicalIndex === -1) {
      insertionPhysicalIndex = end
    } else {
      let toShiftIndex = end
      while (toShiftIndex !== insertionPhysicalIndex) {
        const previousIndex =
          toShiftIndex === 0 ? this.capacity - 1 : toShiftIndex - 1
        this.nodeArray[toShiftIndex] = this.nodeArray[previousIndex]
        toShiftIndex = previousIndex
      }
    }
    this.nodeArray[insertionPhysicalIndex] = { data, priority }
    return ++this.size
  }
}
