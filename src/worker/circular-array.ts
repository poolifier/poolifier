/**
 * Default circular array size.
 */
export const DEFAULT_CIRCULAR_ARRAY_SIZE = 2000

/** Array with a maximum length shifting items when full. */
export class CircularArray<T> extends Array<T> {
  /** @inheritdoc */
  public size: number

  /** @inheritdoc */
  constructor (size: number = DEFAULT_CIRCULAR_ARRAY_SIZE, ...items: T[]) {
    super()
    this.checkSize(size)
    this.size = size
    if (arguments.length > 1) {
      this.push(...items)
    }
  }

  /** @inheritdoc */
  public push (...items: T[]): number {
    const length = super.push(...items)
    if (length > this.size) {
      super.splice(0, length - this.size)
    }
    return this.length
  }

  /** @inheritdoc */
  public unshift (...items: T[]): number {
    const length = super.unshift(...items)
    if (length > this.size) {
      super.splice(this.size, items.length)
    }
    return this.length
  }

  /** @inheritdoc */
  public concat (...items: (T | ConcatArray<T>)[]): CircularArray<T> {
    const concatenatedCircularArray = super.concat(
      items as T[]
    ) as CircularArray<T>
    concatenatedCircularArray.size = this.size
    if (concatenatedCircularArray.length > concatenatedCircularArray.size) {
      concatenatedCircularArray.splice(
        0,
        concatenatedCircularArray.length - concatenatedCircularArray.size
      )
    }
    return concatenatedCircularArray
  }

  /** @inheritdoc */
  public splice (start: number, deleteCount?: number, ...items: T[]): T[] {
    let itemsRemoved: T[]
    if (arguments.length >= 3 && deleteCount !== undefined) {
      itemsRemoved = super.splice(start, deleteCount)
      // FIXME: that makes the items insert not in place
      this.push(...items)
    } else if (arguments.length === 2) {
      itemsRemoved = super.splice(start, deleteCount)
    } else {
      itemsRemoved = super.splice(start)
    }
    return itemsRemoved
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
    } else if (size < this.size) {
      for (let i = size; i < this.size; i++) {
        super.pop()
      }
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
      throw new RangeError('Invalid circular array size')
    }
  }
}
