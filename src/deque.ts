// Copyright Jerome Benoit. 2023. All Rights Reserved.

/**
 * @internal
 */
export class Node<T> {
  public value: T
  public next?: Node<T>
  public prev?: Node<T>

  public constructor (value: T) {
    this.value = value
  }
}

/**
 * Deque.
 * Implemented with a doubly linked list.
 *
 * @typeParam T - Type of deque values.
 * @internal
 */
export class Deque<T> {
  private head?: Node<T>
  private tail?: Node<T>
  /** The size of the deque. */
  public size!: number
  /** The maximum size of the deque. */
  public maxSize!: number

  public constructor () {
    this.clear()
  }

  /**
   * Appends a value to the deque.
   *
   * @param value - Value to append.
   * @returns The new size of the queue.
   */
  public push (value: T): number {
    const node = new Node(value)
    if (this.tail == null) {
      this.head = this.tail = node
    } else {
      node.prev = this.tail
      this.tail = this.tail.next = node
    }
    return this.incrementSize()
  }

  /**
   * Prepends a value to the deque.
   *
   * @param value - Value to prepend.
   * @returns The new size of the queue.
   */
  public unshift (value: T): number {
    const node = new Node(value)
    if (this.head == null) {
      this.head = this.tail = node
    } else {
      node.next = this.head
      this.head = this.head.prev = node
    }
    return this.incrementSize()
  }

  /**
   * Pops a value from the deque.
   *
   * @returns The popped value or `undefined` if the deque is empty.
   */
  public pop (): T | undefined {
    if (this.head == null) {
      return undefined
    }
    const tail = this.tail
    this.tail = (this.tail as Node<T>).prev
    if (this.tail == null) {
      this.head = undefined
    } else {
      this.tail.next = undefined
    }
    --this.size
    return tail?.value
  }

  /**
   * Shifts a value from the deque.
   *
   * @returns The shifted value or `undefined` if the deque is empty.
   */
  public shift (): T | undefined {
    if (this.head == null) {
      return undefined
    }
    const head = this.head
    this.head = this.head.next
    if (this.head == null) {
      this.tail = undefined
    } else {
      this.head.prev = undefined
    }
    --this.size
    return head?.value
  }

  /**
   * Peeks at the first value.
   * @returns The first value or `undefined` if the deque is empty.
   */
  public peekFirst (): T | undefined {
    return this.head?.value
  }

  /**
   * Peeks at the last value.
   * @returns The last value or `undefined` if the deque is empty.
   */
  public peekLast (): T | undefined {
    return this.tail?.value
  }

  /**
   * Clears the deque.
   */
  public clear (): void {
    this.head = undefined
    this.tail = undefined
    this.size = 0
    this.maxSize = 0
  }

  /**
   * Returns an iterator for the deque.
   *
   * @returns An iterator for the deque.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  [Symbol.iterator] (): Iterator<T> {
    let node = this.head
    return {
      next: () => {
        if (node == null) {
          return {
            value: undefined,
            done: true
          }
        }
        const ret = {
          value: node.value,
          done: false
        }
        node = node.next as Node<T>
        return ret
      }
    }
  }

  /**
   * Returns an backward iterator for the deque.
   *
   * @returns An backward iterator for the deque.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  backward (): Iterable<T> {
    return {
      [Symbol.iterator]: (): Iterator<T> => {
        let node = this.tail
        return {
          next: () => {
            if (node == null) {
              return {
                value: undefined,
                done: true
              }
            }
            const ret = {
              value: node.value,
              done: false
            }
            node = node.prev as Node<T>
            return ret
          }
        }
      }
    }
  }

  private incrementSize (): number {
    ++this.size
    if (this.size > this.maxSize) {
      this.maxSize = this.size
    }
    return this.size
  }
}
