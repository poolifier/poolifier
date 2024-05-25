/**
 * Default buffer size.
 */
export const defaultQueueSize = 2048

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

export class FixedPriorityQueue<T> {
  private start!: number
  private readonly nodeArray: Array<PriorityQueueNode<T>>
  public size!: number
  public maxSize!: number

  constructor (size: number = defaultQueueSize) {
    this.checkSize(size)
    this.nodeArray = new Array<PriorityQueueNode<T>>(size)
    this.clear()
  }

  public empty (): boolean {
    return this.size === 0
  }

  public full (): boolean {
    return this.size === this.nodeArray.length
  }

  public enqueue (data: T, priority?: number): number {
    if (this.full()) {
      throw new Error('Priority queue is full')
    }
    priority = priority ?? 0
    let inserted = false
    for (let index = this.start; index < this.nodeArray.length; index++) {
      if (this.nodeArray[index]?.priority > priority) {
        this.nodeArray.splice(index, 0, { data, priority })
        inserted = true
        break
      }
    }
    if (!inserted) {
      let index = this.start + this.size
      if (index >= this.nodeArray.length) {
        index -= this.nodeArray.length
      }
      this.nodeArray[index] = { data, priority }
    }
    return this.incrementSize()
  }

  public dequeue (): T | undefined {
    if (this.empty()) {
      return undefined
    }
    const index = this.start
    --this.size
    ++this.start
    if (this.start === this.nodeArray.length) {
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
    this.maxSize = 0
  }

  /**
   * Returns an iterator for the fixed priority queue.
   *
   * @returns An iterator for the fixed priority queue.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  [Symbol.iterator] (): Iterator<T> {
    let i = this.start
    return {
      next: () => {
        if (i >= this.size) {
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
   * Increments the size of the fixed priority queue.
   *
   * @returns The new size of the fixed priority queue.
   */
  private incrementSize (): number {
    ++this.size
    if (this.size > this.maxSize) {
      this.maxSize = this.size
    }
    return this.size
  }

  private checkSize (size: number): void {
    if (!Number.isSafeInteger(size)) {
      throw new TypeError(
        `Invalid fixed priority queue size: ${size} is not an integer`
      )
    }
    if (size < 0) {
      throw new RangeError(`Invalid fixed priority queue size: ${size} < 0`)
    }
  }
}
