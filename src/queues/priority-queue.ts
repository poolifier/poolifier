// Copyright Jerome Benoit. 2024. All Rights Reserved.

import { FixedPriorityQueue } from './fixed-priority-queue.js'
import { FixedQueue } from './fixed-queue.js'
import {
  defaultBucketSize,
  type FixedQueueNode,
  type IFixedQueue,
  type PriorityQueueNode,
} from './queue-types.js'

/**
 * Priority queue.
 * @typeParam T - Type of priority queue data.
 * @internal
 */
export class PriorityQueue<T> {
  private head!: PriorityQueueNode<T>
  private tail!: PriorityQueueNode<T>
  private readonly bucketSize: number
  private priorityEnabled: boolean
  /** The priority queue maximum size. */
  public maxSize!: number

  /**
   * Constructs a priority queue.
   * @param bucketSize - Prioritized bucket size. @defaultValue defaultBucketSize
   * @param enablePriority - Whether to enable priority. @defaultValue false
   * @returns PriorityQueue.
   */
  public constructor (
    bucketSize: number = defaultBucketSize,
    enablePriority = false
  ) {
    if (!Number.isSafeInteger(bucketSize)) {
      throw new TypeError(
        `Invalid bucket size: '${bucketSize.toString()}' is not an integer`
      )
    }
    if (bucketSize < 0) {
      throw new RangeError(`Invalid bucket size: ${bucketSize.toString()} < 0`)
    }
    this.bucketSize = bucketSize
    this.priorityEnabled = enablePriority
    this.clear()
  }

  /**
   * The priority queue size.
   * @returns The priority queue size.
   */
  public get size (): number {
    let node: PriorityQueueNode<T> | undefined = this.tail
    let size = 0
    while (node != null) {
      size += node.size
      node = node.next
    }
    return size
  }

  public get enablePriority (): boolean {
    return this.priorityEnabled
  }

  public set enablePriority (enablePriority: boolean) {
    if (this.priorityEnabled === enablePriority) {
      return
    }
    this.priorityEnabled = enablePriority
    let head: PriorityQueueNode<T>
    let tail: PriorityQueueNode<T>
    let prevNode: PriorityQueueNode<T> | undefined
    let node: PriorityQueueNode<T> | undefined = this.tail
    let buckets = 0
    while (node != null) {
      const currentNode = this.getPriorityQueueNode(node.nodeArray)
      if (buckets === 0) {
        tail = currentNode
      }
      if (prevNode != null) {
        prevNode.next = currentNode
      }
      prevNode = currentNode
      if (node.next == null) {
        head = currentNode
      }
      ++buckets
      node = node.next
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.head = head!
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.tail = tail!
  }

  /**
   * The number of filled prioritized buckets.
   * @returns The number of filled prioritized buckets.
   */
  public get buckets (): number {
    return Math.trunc(this.size / this.bucketSize)
  }

  /**
   * Enqueue data into the priority queue.
   * @param data - Data to enqueue.
   * @param priority - Priority of the data. Lower values have higher priority.
   * @returns The new size of the priority queue.
   */
  public enqueue (data: T, priority?: number): number {
    if (this.head.full()) {
      this.head = this.head.next = this.getPriorityQueueNode()
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
   * @param bucket - The prioritized bucket to dequeue from.
   * @returns The dequeued data or `undefined` if the priority queue is empty.
   */
  public dequeue (bucket?: number): T | undefined {
    let tail: PriorityQueueNode<T> | undefined = this.tail
    let tailChanged = false
    if (bucket != null && bucket > 0) {
      let currentBucket = 1
      while (tail != null) {
        if (currentBucket === bucket) {
          break
        }
        ++currentBucket
        tail = tail.next
      }
      tailChanged = tail !== this.tail
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const data = tail!.dequeue()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (tail!.empty()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!tailChanged && tail!.next != null) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.tail = tail!.next
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        delete tail!.next
      } else if (tailChanged) {
        let node: PriorityQueueNode<T> | undefined = this.tail
        while (node != null) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (node.next === tail && tail!.next != null) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            node.next = tail!.next
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            delete tail!.next
            break
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          } else if (node.next === tail && tail!.next == null) {
            delete node.next
            this.head = node
            break
          }
          node = node.next
        }
      }
    }
    return data
  }

  /**
   * Deletes the given data from the priority queue.
   * @param data - Data to delete.
   * @returns `true` if the data was deleted, `false` otherwise.
   */
  public delete (data: T): boolean {
    let node: PriorityQueueNode<T> | undefined = this.tail
    let prev: PriorityQueueNode<T> | undefined
    while (node != null) {
      if (node.delete(data)) {
        if (node.empty()) {
          if (node === this.tail && node.next != null) {
            this.tail = node.next
            delete node.next
          } else if (node.next != null && prev != null) {
            prev.next = node.next
            delete node.next
          } else if (node.next == null && prev != null) {
            delete prev.next
            this.head = prev
          }
        }
        return true
      }
      prev = node
      node = node.next
    }
    return false
  }

  /**
   * Clears the priority queue.
   */
  public clear (): void {
    this.head = this.tail = this.getPriorityQueueNode()
    this.maxSize = 0
  }

  /**
   * Returns an iterator for the priority queue.
   * @returns An iterator for the priority queue.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  public [Symbol.iterator] (): Iterator<T> {
    let index = 0
    let node = this.tail
    return {
      next: () => {
        const value = node.get(index) as T
        if (value == null) {
          return {
            value: undefined,
            done: true,
          }
        }
        ++index
        if (index === node.capacity && node.next != null) {
          node = node.next
          index = 0
        }
        return {
          value,
          done: false,
        }
      },
    }
  }

  private getPriorityQueueNode (
    nodeArray?: FixedQueueNode<T>[]
  ): PriorityQueueNode<T> {
    let fixedQueue: IFixedQueue<T>
    if (this.priorityEnabled) {
      fixedQueue = new FixedPriorityQueue(this.bucketSize)
    } else {
      fixedQueue = new FixedQueue(this.bucketSize)
    }
    if (nodeArray != null) {
      fixedQueue.nodeArray = nodeArray
    }
    return fixedQueue
  }
}
