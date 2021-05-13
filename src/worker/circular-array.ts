/** @inheritdoc */
export class CircularArray<T> extends Array<T> {
  /** @inheritdoc */
  public size: number
  private readonly maximumCircularArraySize = 2000

  /** @inheritdoc */
  constructor (size?: number) {
    super()
    this.size =
      size && size <= this.maximumCircularArraySize
        ? size
        : this.maximumCircularArraySize
  }

  /** @inheritdoc */
  push (...items: T[]): number {
    if (this.length + items.length > this.size) {
      super.splice(0, this.length + items.length - this.size)
    }
    return super.push(...items)
  }

  /** @inheritdoc */
  unshift (...items: T[]): number {
    if (this.length + items.length > this.size) {
      super.splice(
        this.size - items.length,
        this.length + items.length - this.size
      )
    }
    return super.unshift(...items)
  }

  /** @inheritdoc */
  concat (...items: (T | ConcatArray<T>)[]): T[] {
    if (this.length + items.length > this.size) {
      super.splice(0, this.length + items.length - this.size)
    }
    return super.concat(items as T[])
  }

  /** @inheritdoc */
  splice (start: number, deleteCount?: number, ...items: T[]): T[] {
    this.push(...items)
    return super.splice(start, deleteCount)
  }

  /**
   *
   * @param size
   */
  resize (size: number): void {
    if (size < 0) {
      throw new RangeError(
        'circular array size does not allow negative values.'
      )
    }
    if (size === 0) {
      this.length = 0
    } else if (size !== this.size) {
      this.slice(-size)
    }
    this.size = size
  }

  /**
   *
   * @returns
   */
  empty (): boolean {
    return this.length === 0
  }

  /**
   *
   * @returns
   */
  full (): boolean {
    return this.length === this.size
  }
}
