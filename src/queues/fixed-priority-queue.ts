import { AbstractFixedQueue } from './abstract-fixed-queue.js'
import type { IFixedQueue } from './queue-types.js'

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
    let inserted = false
    let index = this.start
    for (let i = 0; i < this.size; i++) {
      if (this.nodeArray[index].priority > priority) {
        this.nodeArray.splice(index, 0, { data, priority })
        this.nodeArray.length = this.capacity
        inserted = true
        break
      }
      ++index
      if (index === this.capacity) {
        index = 0
      }
    }
    if (!inserted) {
      let index = this.start + this.size
      if (index >= this.capacity) {
        index -= this.capacity
      }
      this.nodeArray[index] = { data, priority }
    }
    return ++this.size
  }
}
