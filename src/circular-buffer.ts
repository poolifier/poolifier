/**
 * Default buffer size.
 */
export const defaultBufferSize = 2048

/**
 * Circular buffer designed for positive numbers.
 * @internal
 */
export class CircularBuffer {
  private readIdx: number
  private writeIdx: number
  private readonly items: Float32Array
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
    this.items = new Float32Array(size).fill(-1)
  }

  /**
   * Checks whether the buffer is empty.
   * @returns Whether the buffer is empty.
   */
  public empty (): boolean {
    return this.size === 0
  }

  /**
   * Checks whether the buffer is full.
   * @returns Whether the buffer is full.
   */
  public full (): boolean {
    return this.size === this.items.length
  }

  /**
   * Puts number into buffer.
   * @param number - Number to put into buffer.
   */
  public put (number: number): void {
    this.items[this.writeIdx] = number
    this.writeIdx = this.writeIdx === this.maxArrayIdx ? 0 : this.writeIdx + 1
    if (this.size < this.items.length) {
      ++this.size
    }
  }

  /**
   * Gets number from buffer.
   * @returns Number from buffer.
   */
  public get (): number | undefined {
    const number = this.items[this.readIdx]
    if (number === -1) {
      return
    }
    this.items[this.readIdx] = -1
    this.readIdx = this.readIdx === this.maxArrayIdx ? 0 : this.readIdx + 1
    --this.size
    return number
  }

  /**
   * Returns buffer as numbers' array.
   * @returns Numbers' array.
   */
  public toArray (): number[] {
    return Array.from(this.items.filter(item => item !== -1))
  }

  /**
   * Checks the buffer size.
   * @param size - Buffer size.
   */
  private checkSize (size: number): void {
    if (!Number.isSafeInteger(size)) {
      throw new TypeError(
        `Invalid circular buffer size: '${size.toString()}' is not an integer`
      )
    }
    if (size < 0) {
      throw new RangeError(
        `Invalid circular buffer size: ${size.toString()} < 0`
      )
    }
  }
}
