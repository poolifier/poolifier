import { expect } from '@std/expect'

import { FixedPriorityQueue } from '../../lib/queues/fixed-priority-queue.cjs'
import { FixedQueue } from '../../lib/queues/fixed-queue.cjs'
import { PriorityQueue } from '../../lib/queues/priority-queue.cjs'
import { defaultBucketSize } from '../../lib/queues/queue-types.cjs'

describe('Priority queue test suite', () => {
  it('Verify constructor() behavior', () => {
    expect(() => new PriorityQueue('')).toThrow(
      new TypeError("Invalid bucket size: '' is not an integer")
    )
    expect(() => new PriorityQueue(-1)).toThrow(
      new RangeError('Invalid bucket size: -1 < 0')
    )
    let priorityQueue = new PriorityQueue()
    expect(priorityQueue.bucketSize).toBe(defaultBucketSize)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(0)
    expect(priorityQueue.enablePriority).toBe(false)
    expect(priorityQueue.head).toBeInstanceOf(FixedQueue)
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.head.capacity).toBe(defaultBucketSize)
    expect(priorityQueue.tail).toBeInstanceOf(FixedQueue)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    const bucketSize = 2
    priorityQueue = new PriorityQueue(bucketSize, true)
    expect(priorityQueue.bucketSize).toBe(bucketSize)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(0)
    expect(priorityQueue.enablePriority).toBe(true)
    expect(priorityQueue.head).toBeInstanceOf(FixedPriorityQueue)
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.head.capacity).toBe(bucketSize)
    expect(priorityQueue.tail).toBeInstanceOf(FixedPriorityQueue)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
  })

  it('Verify default bucket size enqueue() behavior', () => {
    const priorityQueue = new PriorityQueue(defaultBucketSize, true)
    let rtSize = priorityQueue.enqueue(1)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(1)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    rtSize = priorityQueue.enqueue(2)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(2)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    rtSize = priorityQueue.enqueue(3)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    rtSize = priorityQueue.enqueue(3, -1)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(4)
    expect(priorityQueue.maxSize).toBe(4)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 3, priority: -1 },
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    rtSize = priorityQueue.enqueue(1, 1)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(5)
    expect(priorityQueue.maxSize).toBe(5)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 3, priority: -1 },
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
      { data: 1, priority: 1 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
  })

  it('Verify bucketSize=2 enqueue() behavior', () => {
    const priorityQueue = new PriorityQueue(2, true)
    let rtSize = priorityQueue.enqueue(1)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(1)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    rtSize = priorityQueue.enqueue(2)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(2)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    rtSize = priorityQueue.enqueue(3)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 3, priority: 0 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
    ])
    expect(priorityQueue.tail.next).toStrictEqual(priorityQueue.head)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
    rtSize = priorityQueue.enqueue(3, -1)
    expect(priorityQueue.buckets).toBe(2)
    expect(priorityQueue.size).toBe(4)
    expect(priorityQueue.maxSize).toBe(4)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 3, priority: -1 },
      { data: 3, priority: 0 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
    ])
    expect(priorityQueue.tail.next).toStrictEqual(priorityQueue.head)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
    rtSize = priorityQueue.enqueue(1, 1)
    expect(priorityQueue.buckets).toBe(2)
    expect(priorityQueue.size).toBe(5)
    expect(priorityQueue.maxSize).toBe(5)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 1, priority: 1 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
    ])
    expect(priorityQueue.tail.next.nodeArray).toMatchObject([
      { data: 3, priority: -1 },
      { data: 3, priority: 0 },
    ])
    expect(priorityQueue.tail.next.next).toStrictEqual(priorityQueue.head)
    expect(priorityQueue.tail.next).not.toStrictEqual(priorityQueue.head)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
    rtSize = priorityQueue.enqueue(3, -2)
    expect(priorityQueue.buckets).toBe(3)
    expect(priorityQueue.size).toBe(6)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.head.nodeArray).toMatchObject([
      { data: 3, priority: -2 },
      { data: 1, priority: 1 },
    ])
    expect(priorityQueue.head.next).toBe(undefined)
    expect(priorityQueue.tail.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
    ])
    expect(priorityQueue.tail.next.nodeArray).toMatchObject([
      { data: 3, priority: -1 },
      { data: 3, priority: 0 },
    ])
    expect(priorityQueue.tail.next.next).toStrictEqual(priorityQueue.head)
    expect(priorityQueue.tail.next).not.toStrictEqual(priorityQueue.head)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
  })

  it('Verify default bucket size dequeue() behavior', () => {
    const priorityQueue = new PriorityQueue(defaultBucketSize, true)
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2, -1)
    priorityQueue.enqueue(3)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    let rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtItem).toBe(2)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtItem).toBe(1)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtItem).toBe(3)
    expect(priorityQueue.tail.empty()).toBe(true)
    expect(priorityQueue.tail.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
  })

  it('Verify bucketSize=2 dequeue() behavior', () => {
    const priorityQueue = new PriorityQueue(2, true)
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    priorityQueue.enqueue(3, -1)
    priorityQueue.enqueue(1, 1)
    priorityQueue.enqueue(3, -2)
    expect(priorityQueue.buckets).toBe(3)
    expect(priorityQueue.size).toBe(6)
    expect(priorityQueue.maxSize).toBe(6)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail.next).toBeInstanceOf(FixedPriorityQueue)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
    let rtItem = priorityQueue.dequeue(3)
    expect(priorityQueue.buckets).toBe(2)
    expect(priorityQueue.size).toBe(5)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(3)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail.next).toBeInstanceOf(FixedPriorityQueue)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(2)
    expect(priorityQueue.size).toBe(4)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(1)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail.next).toBeInstanceOf(FixedPriorityQueue)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
    rtItem = priorityQueue.dequeue(2)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(3)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail.next).toBeInstanceOf(FixedPriorityQueue)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
    rtItem = priorityQueue.dequeue(2)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(3)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail.next).toBeInstanceOf(FixedPriorityQueue)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
    rtItem = priorityQueue.dequeue(2)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(1)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(2)
    expect(priorityQueue.tail.empty()).toBe(true)
    expect(priorityQueue.tail.next).toBe(undefined)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
  })

  it('Verify enablePriority setter behavior', () => {
    const priorityQueue = new PriorityQueue(2)
    expect(priorityQueue.enablePriority).toBe(false)
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    priorityQueue.enqueue(4)
    let buckets = 0
    let node = priorityQueue.tail
    while (node != null) {
      expect(node).toBeInstanceOf(FixedQueue)
      node = node.next
      ++buckets
    }
    expect(buckets).toBe(2)
    priorityQueue.enablePriority = true
    expect(priorityQueue.enablePriority).toBe(true)
    buckets = 0
    node = priorityQueue.tail
    while (node != null) {
      expect(node).toBeInstanceOf(FixedPriorityQueue)
      node = node.next
      ++buckets
    }
    expect(buckets).toBe(2)
  })

  it('Verify iterator behavior', () => {
    const priorityQueue = new PriorityQueue(2)
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    let i = 1
    for (const value of priorityQueue) {
      expect(value).toBe(i)
      ++i
    }
  })

  it('Verify clear() behavior', () => {
    const priorityQueue = new PriorityQueue(2)
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    expect(priorityQueue.head.empty()).toBe(false)
    expect(priorityQueue.tail.empty()).toBe(false)
    expect(priorityQueue.tail).not.toStrictEqual(priorityQueue.head)
    priorityQueue.clear()
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(0)
    expect(priorityQueue.head.empty()).toBe(true)
    expect(priorityQueue.tail).toStrictEqual(priorityQueue.head)
  })
})
