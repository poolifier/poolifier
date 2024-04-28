/**
 * @internal
 */
interface PriorityQueueNode<T> {
  data: T
  priority: number
}

/**
 * Priority queue.
 *
 * @typeParam T - Type of priority queue data.
 * @internal
 */
export class PriorityQueue<T> {
  private nodeArray!: Array<PriorityQueueNode<T>>
  /** The size of the priority queue. */
  public size!: number
  /** The maximum size of the priority queue. */
  public maxSize!: number

  public constructor () {
    this.clear()
  }

  /**
   * Enqueue data into the priority queue.
   *
   * @param data - Data to enqueue.
   * @param priority - Priority of the data. Lower values have higher priority.
   * @returns The new size of the priority queue.
   */
  public enqueue (data: T, priority?: number): number {
    priority = priority ?? 0
    let inserted = false
    for (const [index, node] of this.nodeArray.entries()) {
      if (node.priority > priority) {
        this.nodeArray.splice(index, 0, { data, priority })
        inserted = true
        break
      }
    }
    if (!inserted) {
      this.nodeArray.push({ data, priority })
    }
    return this.incrementSize()
  }

  /**
   * Dequeue data from the priority queue.
   *
   * @returns The dequeued data or `undefined` if the priority queue is empty.
   */
  public dequeue (): T | undefined {
    if (this.size > 0) {
      --this.size
    }
    return this.nodeArray.shift()?.data
  }

  /**
   * Peeks at the first data.
   * @returns The first data or `undefined` if the priority queue is empty.
   */
  public peekFirst (): T | undefined {
    return this.nodeArray[0]?.data
  }

  /**
   * Peeks at the last data.
   * @returns The last data or `undefined` if the priority queue is empty.
   */
  public peekLast (): T | undefined {
    return this.nodeArray[this.nodeArray.length - 1]?.data
  }

  /**
   * Clears the priority queue.
   */
  public clear (): void {
    this.nodeArray = []
    this.size = 0
    this.maxSize = 0
  }

  /**
   * Increments the size of the deque.
   *
   * @returns The new size of the deque.
   */
  private incrementSize (): number {
    ++this.size
    if (this.size > this.maxSize) {
      this.maxSize = this.size
    }
    return this.size
  }
}
