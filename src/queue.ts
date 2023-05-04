/**
 * Queue
 */
export class Queue<T> {
  private items: Record<number, T>
  private head: number
  private tail: number

  public constructor () {
    this.items = {}
    this.head = 0
    this.tail = 0
  }

  public get size (): number {
    return this.tail - this.head
  }

  public enqueue (item: T): number {
    this.items[this.tail] = item
    this.tail++
    return this.size
  }

  public dequeue (): T | undefined {
    if (this.size <= 0) return undefined
    const item = this.items[this.head]
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.items[this.head]
    this.head++
    if (this.head === this.tail) {
      this.head = 0
      this.tail = 0
    }
    return item
  }
}
