/**
 * Default buffer size.
 */
export const defaultQueueSize = 2048

/**
 * Fixed priority queue node.
 * @typeParam T - Type of priority queue node data.
 * @internal
 */
export interface FixedPriorityQueueNode<T> {
  data: T
  priority: number
}

/**
 * Fixed priority queue.
 * @typeParam T - Type of fixed priority queue data.
 * @internal
 */
export class FixedPriorityQueue<T> {
  private start!: number
  private readonly nodeArray: FixedPriorityQueueNode<T>[]
  /** The fixed priority queue capacity. */
  public readonly capacity: number
  /** The fixed priority queue size. */
  public size!: number
  /** Whether to enable priority. */
  public enablePriority: boolean

  /**
   * Constructs a fixed priority queue.
   * @param size - Fixed priority queue size. @defaultValue defaultQueueSize
   * @param enablePriority - Whether to enable priority. @defaultValue false
   * @returns FixedPriorityQueue.
   */
  constructor (size: number = defaultQueueSize, enablePriority = false) {
    this.checkSize(size)
    this.capacity = size
    this.enablePriority = enablePriority
    this.nodeArray = new Array<FixedPriorityQueueNode<T>>(this.capacity)
    this.clear()
  }

  /**
   * Checks if the fixed priority queue is empty.
   * @returns `true` if the fixed priority queue is empty, `false` otherwise.
   */
  public empty (): boolean {
    return this.size === 0
  }

  /**
   * Checks if the fixed priority queue is full.
   * @returns `true` if the fixed priority queue is full, `false` otherwise.
   */
  public full (): boolean {
    return this.size === this.capacity
  }

  /**
   * Enqueue data into the fixed priority queue.
   * @param data - Data to enqueue.
   * @param priority - Priority of the data. Lower values have higher priority.
   * @returns The new size of the priority queue.
   * @throws If the fixed priority queue is full.
   */
  public enqueue (data: T, priority?: number): number {
    if (this.full()) {
      throw new Error('Priority queue is full')
    }
    priority = priority ?? 0
    let inserted = false
    if (this.enablePriority) {
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

  /**
   * Gets data from the fixed priority queue.
   * @param index - The index of the data to get.
   * @returns The data at the index or `undefined` if the fixed priority queue is empty or the index is out of bounds.
   */
  public get (index: number): T | undefined {
    if (this.empty() || index >= this.size) {
      return undefined
    }
    index += this.start
    if (index >= this.capacity) {
      index -= this.capacity
    }
    return this.nodeArray[index].data
  }

  /**
   * Dequeue data from the fixed priority queue.
   * @returns The dequeued data or `undefined` if the priority queue is empty.
   */
  public dequeue (): T | undefined {
    if (this.empty()) {
      return undefined
    }
    const index = this.start
    --this.size
    ++this.start
    if (this.start === this.capacity) {
      this.start = 0
    }
    return this.nodeArray[index].data
  }

  /**
   * Clears the fixed priority queue.
   */
  public clear (): void {
    this.start = 0
    this.size = 0
  }

  /**
   * Returns an iterator for the fixed priority queue.
   * @returns An iterator for the fixed priority queue.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  public [Symbol.iterator] (): Iterator<T> {
    let index = this.start
    let i = 0
    return {
      next: () => {
        if (i >= this.size) {
          return {
            value: undefined,
            done: true,
          }
        }
        const value = this.nodeArray[index].data
        ++index
        ++i
        if (index === this.capacity) {
          index = 0
        }
        return {
          value,
          done: false,
        }
      },
    }
  }

  /**
   * Checks the queue size.
   * @param size - Queue size.
   */
  private checkSize (size: number): void {
    if (!Number.isSafeInteger(size)) {
      throw new TypeError(
        `Invalid fixed priority queue size: '${size.toString()}' is not an integer`
      )
    }
    if (size < 0) {
      throw new RangeError(
        `Invalid fixed priority queue size: ${size.toString()} < 0`
      )
    }
  }
}
