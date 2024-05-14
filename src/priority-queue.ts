// Copyright Jerome Benoit. 2024. All Rights Reserved.

/**
 * Priority queue node.
 *
 * @typeParam T - Type of priority queue node data.
 * @internal
 */
export interface PriorityQueueNode<T> {
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
  /** Prioritized bucket size. */
  private readonly k: number
  /** The size of the priority queue. */
  public size!: number
  /** The maximum size of the priority queue. */
  public maxSize!: number

  /**
   * The number of filled prioritized buckets.
   */
  public get buckets (): number {
    return this.k === Infinity ? 1 : Math.trunc(this.nodeArray.length / this.k)
  }

  /**
   * Constructs a priority queue.
   *
   * @param k - Prioritized bucket size. @defaultValue Infinity
   */
  public constructor (k = Infinity) {
    if (k !== Infinity && !Number.isSafeInteger(k)) {
      throw new TypeError('k must be an integer')
    }
    if (k < 1) {
      throw new RangeError('k must be greater than or equal to 1')
    }
    this.k = k
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
    const startIndex = this.k === Infinity ? 0 : this.buckets * this.k
    let inserted = false
    for (let index = startIndex; index < this.nodeArray.length; index++) {
      if (this.nodeArray[index].priority > priority) {
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
   * @param bucket - The prioritized bucket to dequeue from. @defaultValue 0
   * @returns The dequeued data or `undefined` if the priority queue is empty.
   */
  public dequeue (bucket = 0): T | undefined {
    if (this.k !== Infinity && bucket > 0) {
      while (bucket > 0) {
        const index = bucket * this.k
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this.nodeArray[index] != null) {
          --this.size
          return this.nodeArray.splice(index, 1)[0].data
        }
        --bucket
      }
    }
    this.decrementSize()
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
   * Returns an iterator for the priority queue.
   *
   * @returns An iterator for the priority queue.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  [Symbol.iterator] (): Iterator<T> {
    let i = 0
    return {
      next: () => {
        if (i >= this.nodeArray.length) {
          return {
            value: undefined,
            done: true
          }
        }
        const value = this.nodeArray[i].data
        i++
        return {
          value,
          done: false
        }
      }
    }
  }

  /**
   * Increments the size of the priority queue.
   *
   * @returns The new size of the priority queue.
   */
  private incrementSize (): number {
    ++this.size
    if (this.size > this.maxSize) {
      this.maxSize = this.size
    }
    return this.size
  }

  /**
   * Decrements the size of the priority queue.
   *
   * @returns The new size of the priority queue.
   */
  private decrementSize (): number {
    if (this.size > 0) {
      --this.size
    }
    return this.size
  }
}
