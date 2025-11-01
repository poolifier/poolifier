// Copyright Jerome Benoit. 2024. All Rights Reserved.

import { FixedPriorityQueue } from './fixed-priority-queue.js'
import { FixedQueue } from './fixed-queue.js'
import {
  defaultBucketSize,
  type IFixedQueue,
  type PriorityQueueNode,
} from './queue-types.js'

/**
 * Priority queue.
 * @typeParam T - Type of priority queue data.
 * @internal
 */
export class PriorityQueue<T> {
  /** The priority queue maximum size. */
  public maxSize!: number
  /** The priority queue size. */
  public size!: number
  /**
   * The number of filled prioritized buckets.
   * @returns The number of filled prioritized buckets.
   */
  public get buckets (): number {
    return Math.trunc(this.size / this.bucketSize)
  }

  /**
   * Whether priority is enabled.
   * @returns Whether priority is enabled.
   */
  public get enablePriority (): boolean {
    return this.priorityEnabled
  }

  /**
   * Enables/disables priority.
   * @param enablePriority - Whether to enable priority.
   */
  public set enablePriority (enablePriority: boolean) {
    if (this.priorityEnabled === enablePriority) {
      return
    }
    this.priorityEnabled = enablePriority
    const data: T[] = Array.from(this)
    this.clear()
    for (const dataItem of data) {
      this.enqueue(dataItem)
    }
  }

  private readonly bucketSize: number
  private head!: PriorityQueueNode<T>
  private priorityEnabled: boolean
  private tail!: PriorityQueueNode<T>

  /**
   * Constructs a priority queue.
   * @param bucketSize - Prioritized bucket size.
   * @defaultValue defaultBucketSize
   * @param enablePriority - Whether to enable priority.
   * @defaultValue false
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
    if (bucketSize <= 0) {
      throw new RangeError(`Invalid bucket size: ${bucketSize.toString()} <= 0`)
    }
    this.bucketSize = bucketSize
    this.priorityEnabled = enablePriority
    this.clear()
  }

  /**
   * Clears the priority queue.
   */
  public clear (): void {
    this.head = this.tail = this.getPriorityQueueNode()
    this.size = 0
    this.maxSize = 0
  }

  /**
   * Deletes the given data from the priority queue.
   * @param data - Data to delete.
   * @returns `true` if the data was deleted, `false` otherwise.
   */
  public delete (data: T): boolean {
    if (this.size === 0) {
      return false
    }
    let node: PriorityQueueNode<T> | undefined = this.tail
    let prev: PriorityQueueNode<T> | undefined
    while (node != null) {
      if (node.delete(data)) {
        if (node.empty()) {
          this.removePriorityQueueNode(node, prev)
        }
        --this.size
        return true
      }
      prev = node
      node = node.next
    }
    return false
  }

  /**
   * Dequeue data from the priority queue.
   * @param bucket - The prioritized bucket to dequeue from.
   * @returns The dequeued data or `undefined` if the priority queue is empty.
   */
  public dequeue (bucket?: number): T | undefined {
    if (this.size === 0) {
      return undefined
    }
    let targetNode: PriorityQueueNode<T> | undefined = this.tail
    let prev: PriorityQueueNode<T> | undefined
    if (bucket != null && bucket > 0) {
      let currentBucket = 1
      while (targetNode.next != null && currentBucket < bucket) {
        prev = targetNode
        targetNode = targetNode.next
        ++currentBucket
      }
      if (currentBucket < bucket || targetNode.empty()) {
        return undefined
      }
    } else {
      while (targetNode?.empty() === true && targetNode !== this.head) {
        prev = targetNode
        targetNode = targetNode.next
      }
    }
    if (targetNode == null || targetNode.empty()) {
      return undefined
    }
    const data = targetNode.dequeue()
    --this.size
    if (targetNode.empty()) {
      this.removePriorityQueueNode(targetNode, prev)
    }
    return data
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
    ++this.size
    if (this.size > this.maxSize) {
      this.maxSize = this.size
    }
    return this.size
  }

  /**
   * Returns an iterator for the priority queue.
   * @returns An iterator for the priority queue.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  public [Symbol.iterator] (): Iterator<T> {
    let node: PriorityQueueNode<T> | undefined = this.tail
    let index = 0
    return {
      next: (): IteratorResult<T> => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
          if (node == null) {
            return { done: true, value: undefined }
          }

          while (index >= node.size) {
            node = node.next
            index = 0
            if (node == null) {
              return { done: true, value: undefined }
            }
          }

          const value = node.get(index)
          ++index
          if (value != null) {
            return { done: false, value }
          }
        }
      },
    }
  }

  private getPriorityQueueNode (): PriorityQueueNode<T> {
    let fixedQueue: IFixedQueue<T>
    if (this.priorityEnabled) {
      fixedQueue = new FixedPriorityQueue(this.bucketSize)
    } else {
      fixedQueue = new FixedQueue(this.bucketSize)
    }
    return fixedQueue
  }

  private removePriorityQueueNode (
    nodeToRemove: PriorityQueueNode<T>,
    previousNode?: PriorityQueueNode<T>
  ): void {
    if (this.head === this.tail) {
      return
    }

    if (nodeToRemove === this.tail && nodeToRemove.next != null) {
      this.tail = nodeToRemove.next
    } else if (nodeToRemove === this.head && previousNode != null) {
      this.head = previousNode
      this.head.next = undefined
    } else if (previousNode != null) {
      previousNode.next = nodeToRemove.next
    }

    nodeToRemove.next = undefined
  }
}
