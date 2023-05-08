// Copyright Jerome Benoit. 2021-2023. All Rights Reserved.

/**
 * Queue
 *
 * @typeParam T - Type of queue items.
 */
export class Queue<T> {
  private items: Record<number, T>
  private head: number
  private tail: number

  public constructor () {
    this.items = {}
    this.head = 0
    this.tail = 0
  }

  /**
   * Get the size of the queue.
   *
   * @returns The size of the queue.
   * @readonly
   */
  public get size (): number {
    return this.tail - this.head
  }

  /**
   * Enqueue an item.
   *
   * @param item - Item to enqueue.
   * @returns The new size of the queue.
   */
  public enqueue (item: T): number {
    this.items[this.tail] = item
    this.tail++
    return this.size
  }

  /**
   * Dequeue an item.
   *
   * @returns The dequeued item or `undefined` if the queue is empty.
   */
  public dequeue (): T | undefined {
    if (this.size <= 0) return undefined
    const item = this.items[this.head]
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.items[this.head]
    this.head++
    if (this.head === this.tail) {
      this.head = 0
      this.tail = 0
    }
    return item
  }

  /**
   * Peek at the first item.
   */
  public peek (): T | undefined {
    if (this.size <= 0) return undefined
    return this.items[this.head]
  }
}
