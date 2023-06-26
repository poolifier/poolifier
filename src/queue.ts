// Copyright Jerome Benoit. 2021-2023. All Rights Reserved.

/**
 * Queue
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
   * Peek at the first item.
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
   * Clear the queue.
   */
  public clear (): void {
    this.items = []
    this.offset = 0
    this.size = 0
    this.maxSize = 0
  }
}
