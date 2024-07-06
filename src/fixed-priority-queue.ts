import {
  defaultQueueSize,
  type FixedQueueNode,
  type IFixedQueue,
} from './utility-types.js'

/**
 * Fixed priority queue.
 * @typeParam T - Type of fixed priority queue data.
 * @internal
 */
export class FixedPriorityQueue<T> implements IFixedQueue<T> {
  private start!: number
  /** @inheritdoc */
  public readonly capacity: number
  /** @inheritdoc */
  public size!: number
  /** @inheritdoc */
  public nodeArray: FixedQueueNode<T>[]

  /**
   * Constructs a fixed priority queue.
   * @param size - Fixed priority queue size. @defaultValue defaultQueueSize
   * @returns FixedPriorityQueue.
   */
  constructor (size: number = defaultQueueSize) {
    this.checkSize(size)
    this.capacity = size
    this.nodeArray = new Array<FixedQueueNode<T>>(this.capacity)
    this.clear()
  }

  /** @inheritdoc */
  public empty (): boolean {
    return this.size === 0
  }

  /** @inheritdoc */
  public full (): boolean {
    return this.size === this.capacity
  }

  /** @inheritdoc */
  public enqueue (data: T, priority?: number): number {
    if (this.full()) {
      throw new Error('Priority queue is full')
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

  /** @inheritdoc */
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

  /** @inheritdoc */
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

  /** @inheritdoc */
  public clear (): void {
    this.start = 0
    this.size = 0
  }

  /** @inheritdoc */
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
   * Checks the fixed queue size.
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
