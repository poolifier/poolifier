// Copyright Jerome Benoit. 2024. All Rights Reserved.

import { FixedPriorityQueue } from './fixed-priority-queue.js'

/**
 * Default bucket size.
 */
export const defaultBucketSize = 2048

/**
 * Priority queue node.
 *
 * @typeParam T - Type of priority queue node data.
 * @internal
 */
export interface PriorityQueueNode<T> extends FixedPriorityQueue<T> {
  next?: FixedPriorityQueue<T>
}

/**
 * Priority queue.
 *
 * @typeParam T - Type of priority queue data.
 * @internal
 */
export class PriorityQueue<T> {
  private head!: PriorityQueueNode<T>
  private tail!: PriorityQueueNode<T>
  private readonly bucketSize: number
  public maxSize!: number

  /**
   * Constructs a priority queue.
   *
   * @param bucketSize - Prioritized bucket size. @defaultValue defaultBucketSize
   * @returns PriorityQueue.
   */
  public constructor (bucketSize: number = defaultBucketSize) {
    this.bucketSize = bucketSize
    this.clear()
  }

  /** The size of the priority queue. */
  public get size (): number {
    let node: PriorityQueueNode<T> | undefined = this.tail
    let size = 0
    while (node != null) {
      size += node.size
      node = node.next
    }
    return size
  }

  /**
   * Enqueue data into the priority queue.
   *
   * @param data - Data to enqueue.
   * @param priority - Priority of the data. Lower values have higher priority.
   * @returns The new size of the priority queue.
   */
  public enqueue (data: T, priority?: number): number {
    if (this.head.full()) {
      this.head = this.head.next = new FixedPriorityQueue(this.bucketSize)
    }
    this.head.enqueue(data, priority)
    const size = this.size
    if (size > this.maxSize) {
      this.maxSize = size
    }
    return size
  }

  /**
   * Dequeue data from the priority queue.
   *
   * @param bucket - The prioritized bucket to dequeue from.
   * @returns The dequeued data or `undefined` if the priority queue is empty.
   */
  public dequeue (bucket?: number): T | undefined {
    let tail: PriorityQueueNode<T> | undefined = this.tail
    if (bucket != null) {
      let currentBucket = 0
      while (tail != null) {
        ++currentBucket
        if (currentBucket === bucket) {
          break
        }
        tail = tail.next
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const data = tail!.dequeue()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (tail!.empty() && tail!.next != null) {
      if (tail === this.tail) {
        this.tail = tail.next
      } else {
        let node: PriorityQueueNode<T> | undefined = this.tail
        while (node != null) {
          if (node.next === tail) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            node.next = tail!.next
            break
          }
          node = node.next
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      delete tail!.next
    }
    return data
  }

  /**
   * Clears the priority queue.
   */
  public clear (): void {
    this.head = this.tail = new FixedPriorityQueue(this.bucketSize)
    this.maxSize = 0
  }

  /**
   * Returns an iterator for the priority queue.
   *
   * @returns An iterator for the priority queue.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  public [Symbol.iterator] (): Iterator<T> {
    let i = 0
    let node = this.tail
    return {
      next: () => {
        if (node.empty() || (i >= node.capacity && node.next == null)) {
          return {
            value: undefined,
            done: true
          }
        }
        const value = node.dequeue() as T
        ++i
        if (i === node.capacity && node.next != null) {
          node = node.next
          i = 0
        }
        return {
          value,
          done: false
        }
      }
    }
  }
}
