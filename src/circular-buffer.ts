/**
 * Default buffer size.
 */
export const defaultBufferSize = 2048

/**
 * Circular buffer.
 *
 * @typeParam T - Type of buffer data.
 * @internal
 */
export class CircularBuffer<T> {
  private readIdx: number
  private writeIdx: number
  private items: Array<T | undefined>
  private readonly maxArrayIdx: number
  public size: number

  /**
   * @param size - Buffer size. @defaultValue defaultBufferSize
   * @returns CircularBuffer.
   */
  constructor (size: number = defaultBufferSize) {
    this.checkSize(size)
    this.readIdx = 0
    this.writeIdx = 0
    this.maxArrayIdx = size - 1
    this.size = 0
    this.items = new Array<T | undefined>(size)
  }

  /**
   * Checks whether the buffer is empty.
   *
   * @returns Whether the buffer is empty.
   */
  public empty (): boolean {
    return this.size === 0
  }

  /**
   * Checks whether the buffer is full.
   *
   * @returns Whether the buffer is full.
   */
  public full (): boolean {
    return this.size === this.items.length
  }

  /**
   * Puts data into buffer.
   *
   * @param data - Data to put into buffer.
   */
  public put (data: T): void {
    this.items[this.writeIdx] = data
    this.writeIdx = this.writeIdx === this.maxArrayIdx ? 0 : this.writeIdx + 1
    if (this.size < this.items.length) {
      ++this.size
    }
  }

  /**
   * Gets data from buffer.
   *
   * @returns Data from buffer.
   */
  public get (): T | undefined {
    const data = this.items[this.readIdx]
    if (data == null) {
      return
    }
    this.items[this.readIdx] = undefined
    this.readIdx = this.readIdx === this.maxArrayIdx ? 0 : this.readIdx + 1
    --this.size
    return data
  }

  /**
   * Returns buffer as array.
   *
   * @returns Array of buffer data.
   */
  public toArray (): T[] {
    return this.items.filter(item => item != null) as T[]
  }

  private checkSize (size: number): void {
    if (!Number.isSafeInteger(size)) {
      throw new TypeError(
        `Invalid circular buffer size: ${size} is not an integer`
      )
    }
    if (size < 0) {
      throw new RangeError(`Invalid circular buffer size: ${size} < 0`)
    }
  }
}
