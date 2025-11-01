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
  /** @inheritdoc */
  public readonly capacity: number
  /** @inheritdoc */
  public readonly nodeArray: (FixedQueueNode<T> | undefined)[]
  /** @inheritdoc */
  public size!: number
  protected start!: number

  /**
   * Constructs a fixed queue.
   * @param size - Fixed queue size.
   * @defaultValue defaultQueueSize
   * @returns IFixedQueue.
   */
  constructor (size: number = defaultQueueSize) {
    this.checkSize(size)
    this.capacity = size
    this.nodeArray = new Array<FixedQueueNode<T>>(this.capacity)
    this.clear()
  }

  /** @inheritdoc */
  public clear (): void {
    if (this.size > 0) {
      let index = this.start
      for (let i = 0; i < this.size; i++) {
        this.nodeArray[index] = undefined
        ++index
        if (index === this.capacity) {
          index = 0
        }
      }
    }
    this.start = 0
    this.size = 0
  }

  /** @inheritdoc */
  public delete (data: T): boolean {
    if (this.empty()) return false
    let currentPhysicalIndex = this.start
    let logicalIndex = -1
    for (let i = 0; i < this.size; i++) {
      if (this.nodeArray[currentPhysicalIndex]?.data === data) {
        logicalIndex = i
        break
      }
      ++currentPhysicalIndex
      if (currentPhysicalIndex === this.capacity) {
        currentPhysicalIndex = 0
      }
    }
    if (logicalIndex !== -1) {
      if (logicalIndex === this.size - 1) {
        this.nodeArray[currentPhysicalIndex] = undefined
        --this.size
        return true
      }
      let shiftPhysicalIndex = currentPhysicalIndex
      for (let i = logicalIndex; i < this.size - 1; i++) {
        let nextPhysicalIndex = shiftPhysicalIndex + 1
        if (nextPhysicalIndex === this.capacity) {
          nextPhysicalIndex = 0
        }
        this.nodeArray[shiftPhysicalIndex] = this.nodeArray[nextPhysicalIndex]
        shiftPhysicalIndex = nextPhysicalIndex
      }
      this.nodeArray[shiftPhysicalIndex] = undefined
      --this.size
      return true
    }
    return false
  }

  /** @inheritdoc */
  public dequeue (): T | undefined {
    if (this.empty()) {
      return undefined
    }
    const index = this.start
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const data = this.nodeArray[index]!.data
    this.nodeArray[index] = undefined
    ++this.start
    if (this.start === this.capacity) {
      this.start = 0
    }
    --this.size
    return data
  }

  /** @inheritdoc */
  public empty (): boolean {
    return this.size === 0
  }

  /** @inheritdoc */
  public abstract enqueue (data: T, priority?: number): number

  /** @inheritdoc */
  public full (): boolean {
    return this.size === this.capacity
  }

  /** @inheritdoc */
  public get (index: number): T | undefined {
    if (this.empty() || index < 0 || index >= this.size) {
      return undefined
    }
    index += this.start
    if (index >= this.capacity) {
      index -= this.capacity
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.nodeArray[index]!.data
  }

  /** @inheritdoc */
  public [Symbol.iterator] (): Iterator<T> {
    let index = this.start
    let i = 0
    return {
      next: (): IteratorResult<T> => {
        if (i >= this.size) {
          return {
            done: true,
            value: undefined,
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const value = this.nodeArray[index]!.data
        ++index
        ++i
        if (index === this.capacity) {
          index = 0
        }
        return {
          done: false,
          value,
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
    if (size <= 0) {
      throw new RangeError(`Invalid fixed queue size: ${size.toString()} <= 0`)
    }
  }
}
