import { AbstractFixedQueue } from './abstract-fixed-queue.js'
import type { IFixedQueue } from './utility-types.js'

/**
 * Fixed queue.
 * @typeParam T - Type of fixed queue data.
 * @internal
 */
export class FixedQueue<T>
  extends AbstractFixedQueue<T>
  implements IFixedQueue<T> {
  /** @inheritdoc */
  public enqueue (data: T, priority?: number): number {
    if (this.full()) {
      throw new Error('Fixed queue is full')
    }
    let index = this.start + this.size
    if (index >= this.capacity) {
      index -= this.capacity
    }
    this.nodeArray[index] = { data, priority: priority ?? 0 }
    return ++this.size
  }
}
