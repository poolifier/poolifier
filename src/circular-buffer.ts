/**
 * Default buffer size
 */
export const defaultBufferSize = 2048

/**
 * Circular buffer
 */
export class CircularBuffer<T> {
  private readonly readIdx: number
  private writeIdx: number
  private items: Array<T | undefined>
  private readonly maxArrayIdx: number

  /**
   * @param size - Buffer size
   * @returns CircularBuffer
   */
  constructor (size: number = defaultBufferSize) {
    this.checkSize(size)
    this.readIdx = 0
    this.writeIdx = 0
    this.maxArrayIdx = size - 1
    this.items = new Array<T | undefined>(size)
  }

  /**
   * Puts data into buffer
   *
   * @param data - Data to put into buffer
   */
  public put (data: T): void {
    this.items[this.writeIdx] = data
    this.writeIdx = this.writeIdx === this.maxArrayIdx ? 0 : this.writeIdx + 1
  }

  /**
   * Returns buffer as array
   *
   * @returns T[]
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
