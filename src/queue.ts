/**
 * Queue
 */
export class Queue<T> {
  private items: Record<number, T>
  private head: number
  private tail: number

  constructor () {
    this.items = {}
    this.head = 0
    this.tail = 0
  }

  enqueue (item: T): number {
    this.items[this.tail] = item
    this.tail++
    return this.size()
  }

  dequeue (): T | undefined {
    if (this.size() <= 0) return undefined
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

  size (): number {
    return this.tail - this.head
  }
}
