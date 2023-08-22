// Copyright Jerome Benoit. 2022-2023. All Rights Reserved.

/**
 * Queue.
 *
 * @typeParam T - Type of queue items.
 */
export class Queue<T> {
  private items!: T[]
  private offset!: number
  /** The size of the queue. */
  public size!: number
  /** The maximum size of the queue. */
  public maxSize!: number

  public constructor () {
    this.clear()
  }

  /**
   * Enqueue an item.
   *
   * @param item - Item to enqueue.
   * @returns The new size of the queue.
   */
  public enqueue (item: T): number {
    this.items.push(item)
    ++this.size
    if (this.size > this.maxSize) {
      this.maxSize = this.size
    }
    return this.size
  }

  /**
   * Dequeue an item.
   *
   * @returns The dequeued item or `undefined` if the queue is empty.
   */
  public dequeue (): T | undefined {
    if (this.size <= 0) {
      return undefined
    }
    const item = this.items[this.offset]
    if (++this.offset * 2 >= this.items.length) {
      this.items = this.items.slice(this.offset)
      this.offset = 0
    }
    --this.size
    return item
  }

  /**
   * Peeks at the first item.
   *
   * @returns The first item or `undefined` if the queue is empty.
   */
  public peek (): T | undefined {
    if (this.size <= 0) {
      return undefined
    }
    return this.items[this.offset]
  }

  /**
   * Clears the queue.
   */
  public clear (): void {
    this.items = []
    this.offset = 0
    this.size = 0
    this.maxSize = 0
  }

  /**
   * Returns an iterator for the queue.
   *
   * @returns An iterator for the queue.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  [Symbol.iterator] (): Iterator<T> {
    const items = this.items
    let i = this.offset

    return {
      next: () => {
        if (i >= items.length) {
          return {
            value: undefined,
            done: true
          }
        }
        const value = items[i]
        ++i
        return {
          value,
          done: false
        }
      }
    }
  }
}
