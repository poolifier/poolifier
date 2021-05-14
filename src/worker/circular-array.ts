const DEFAULT_CIRCULAR_ARRAY_SIZE = 2000

/** @inheritdoc */
export class CircularArray<T> extends Array<T> {
  /** @inheritdoc */
  public size: number

  /** @inheritdoc */
  constructor (size?: number) {
    super()
    if (size) {
      this.checkSize(size)
    }
    this.size = size ?? DEFAULT_CIRCULAR_ARRAY_SIZE
  }

  /** @inheritdoc */
  public push (...items: T[]): number {
    if (this.length + items.length > this.size) {
      super.splice(0, this.length + items.length - this.size)
    }
    return super.push(...items)
  }

  /** @inheritdoc */
  public unshift (...items: T[]): number {
    if (this.length + items.length > this.size) {
      super.splice(
        this.size - items.length,
        this.length + items.length - this.size
      )
    }
    return super.unshift(...items)
  }

  /** @inheritdoc */
  public concat (...items: (T | ConcatArray<T>)[]): T[] {
    if (this.length + items.length > this.size) {
      super.splice(0, this.length + items.length - this.size)
    }
    return super.concat(items as T[])
  }

  /** @inheritdoc */
  public splice (start: number, deleteCount?: number, ...items: T[]): T[] {
    this.push(...items)
    return super.splice(start, deleteCount)
  }

  /**
   * Resize.
   *
   * @param size Size.
   */
  public resize (size: number): void {
    this.checkSize(size)
    if (size === 0) {
      this.length = 0
    } else if (size !== this.size) {
      super.slice(-size)
    }
    this.size = size
  }

  /**
   * Returns `true` if it's currently empty.
   *
   * @returns `true` if empty, otherwise `false`.
   */
  public empty (): boolean {
    return this.length === 0
  }

  /**
   * Returns `true` if it's currently full.
   *
   * @returns `true` if full, otherwise `false`.
   */
  public full (): boolean {
    return this.length === this.size
  }

  private checkSize (size: number) {
    if (size < 0) {
      throw new RangeError(
        'circular array size does not allow negative values.'
      )
    }
  }
}
