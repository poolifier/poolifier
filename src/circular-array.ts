// Copyright Jerome Benoit. 2021-2023. All Rights Reserved.

export const DEFAULT_CIRCULAR_ARRAY_SIZE = 1024

/**
 * Array with a maximum length and shifting items when full.
 *
 * @typeParam T - Type of items.
 * @internal
 */
export class CircularArray<T> extends Array<T> {
  public size: number

  constructor (size: number = DEFAULT_CIRCULAR_ARRAY_SIZE, ...items: T[]) {
    super()
    this.checkSize(size)
    this.size = size
    if (arguments.length > 1) {
      this.push(...items)
    }
  }

  /** @inheritDoc */
  public push (...items: T[]): number {
    const length = super.push(...items)
    if (length > this.size) {
      super.splice(0, length - this.size)
    }
    return this.length
  }

  /** @inheritDoc */
  public unshift (...items: T[]): number {
    const length = super.unshift(...items)
    if (length > this.size) {
      super.splice(this.size, items.length)
    }
    return this.length
  }

  /** @inheritDoc */
  public concat (...items: Array<T | ConcatArray<T>>): CircularArray<T> {
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

  /** @inheritDoc */
  public splice (
    start: number,
    deleteCount?: number,
    ...items: T[]
  ): CircularArray<T> {
    let itemsRemoved: T[] = []
    if (arguments.length >= 3 && deleteCount != null) {
      itemsRemoved = super.splice(start, deleteCount, ...items)
      if (this.length > this.size) {
        const itemsOverflowing = super.splice(0, this.length - this.size)
        itemsRemoved = new CircularArray<T>(
          itemsRemoved.length + itemsOverflowing.length,
          ...itemsRemoved,
          ...itemsOverflowing
        )
      }
    } else if (arguments.length === 2) {
      itemsRemoved = super.splice(start, deleteCount)
    } else {
      itemsRemoved = super.splice(start)
    }
    return itemsRemoved as CircularArray<T>
  }

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

  public empty (): boolean {
    return this.length === 0
  }

  public full (): boolean {
    return this.length === this.size
  }

  private checkSize (size: number): void {
    if (!Number.isSafeInteger(size)) {
      throw new TypeError(
        `Invalid circular array size: ${size} is not a safe integer`
      )
    }
    if (size < 0) {
      throw new RangeError(`Invalid circular array size: ${size} < 0`)
    }
  }
}
