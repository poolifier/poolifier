// Copyright Jerome Benoit. 2021-2023. All Rights Reserved.

const DEFAULT_CIRCULAR_ARRAY_SIZE = 1024

/**
 * Array with a maximum length shifting items when full.
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

  public push (...items: T[]): number {
    const length = super.push(...items)
    if (length > this.size) {
      super.splice(0, length - this.size)
    }
    return this.length
  }

  public unshift (...items: T[]): number {
    const length = super.unshift(...items)
    if (length > this.size) {
      super.splice(this.size, items.length)
    }
    return this.length
  }

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
