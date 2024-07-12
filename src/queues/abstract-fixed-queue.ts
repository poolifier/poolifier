import {
  defaultQueueSize,
  type FixedQueueNode,
  type IFixedQueue,
} from './queue-types.js'

/**
 * Base fixed queue class.
 * @typeParam T - Type of fixed queue data.
 * @internal
 */
export abstract class AbstractFixedQueue<T> implements IFixedQueue<T> {
  protected start!: number
  /** @inheritdoc */
  public readonly capacity: number
  /** @inheritdoc */
  public size!: number
  /** @inheritdoc */
  public nodeArray: FixedQueueNode<T>[]

  /**
   * Constructs a fixed queue.
   * @param size - Fixed queue size. @defaultValue defaultQueueSize
   * @returns IFixedQueue.
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
  public abstract enqueue (data: T, priority?: number): number

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
        `Invalid fixed queue size: '${size.toString()}' is not an integer`
      )
    }
    if (size < 0) {
      throw new RangeError(`Invalid fixed queue size: ${size.toString()} < 0`)
    }
  }
}
