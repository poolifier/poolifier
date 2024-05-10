import { expect } from 'expect'

import { PriorityQueue } from '../lib/priority-queue.cjs'

describe('Priority queue test suite', () => {
  it('Verify constructor() behavior', () => {
    expect(() => new PriorityQueue('')).toThrow(
      new TypeError('k must be an integer')
    )
    expect(() => new PriorityQueue(-1)).toThrow(
      new RangeError('k must be greater than or equal to 1')
    )
    expect(() => new PriorityQueue(0)).toThrow(
      new RangeError('k must be greater than or equal to 1')
    )
    let priorityQueue = new PriorityQueue()
    expect(priorityQueue.k).toBe(Infinity)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(0)
    expect(priorityQueue.nodeArray).toStrictEqual([])
    priorityQueue = new PriorityQueue(2)
    expect(priorityQueue.k).toBe(2)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(0)
    expect(priorityQueue.nodeArray).toStrictEqual([])
  })

  it('Verify default k enqueue() behavior', () => {
    const priorityQueue = new PriorityQueue()
    let rtSize = priorityQueue.enqueue(1)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(1)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([{ data: 1, priority: 0 }])
    rtSize = priorityQueue.enqueue(2)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(2)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 }
    ])
    rtSize = priorityQueue.enqueue(3)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 }
    ])
    rtSize = priorityQueue.enqueue(3, -1)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(4)
    expect(priorityQueue.maxSize).toBe(4)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 3, priority: -1 },
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 }
    ])
    rtSize = priorityQueue.enqueue(1, 1)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(5)
    expect(priorityQueue.maxSize).toBe(5)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 3, priority: -1 },
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
      { data: 1, priority: 1 }
    ])
  })

  it('Verify k=2 enqueue() behavior', () => {
    const priorityQueue = new PriorityQueue(2)
    let rtSize = priorityQueue.enqueue(1)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(1)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([{ data: 1, priority: 0 }])
    rtSize = priorityQueue.enqueue(2)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(2)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 }
    ])
    rtSize = priorityQueue.enqueue(3)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 }
    ])
    rtSize = priorityQueue.enqueue(3, -1)
    expect(priorityQueue.buckets).toBe(2)
    expect(priorityQueue.size).toBe(4)
    expect(priorityQueue.maxSize).toBe(4)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: -1 },
      { data: 3, priority: 0 }
    ])
    rtSize = priorityQueue.enqueue(1, 1)
    expect(priorityQueue.buckets).toBe(2)
    expect(priorityQueue.size).toBe(5)
    expect(priorityQueue.maxSize).toBe(5)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: -1 },
      { data: 3, priority: 0 },
      { data: 1, priority: 1 }
    ])
    rtSize = priorityQueue.enqueue(3, -2)
    expect(priorityQueue.buckets).toBe(3)
    expect(priorityQueue.size).toBe(6)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: -1 },
      { data: 3, priority: 0 },
      { data: 3, priority: -2 },
      { data: 1, priority: 1 }
    ])
  })

  it('Verify default k dequeue() behavior', () => {
    const priorityQueue = new PriorityQueue()
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2, -1)
    priorityQueue.enqueue(3)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    let rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtItem).toBe(2)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 3, priority: 0 }
    ])
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtItem).toBe(1)
    expect(priorityQueue.nodeArray).toStrictEqual([{ data: 3, priority: 0 }])
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtItem).toBe(3)
    expect(priorityQueue.nodeArray).toStrictEqual([])
  })

  it('Verify k=2 dequeue() behavior', () => {
    const priorityQueue = new PriorityQueue(2)
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    priorityQueue.enqueue(3, -1)
    priorityQueue.enqueue(1, 1)
    priorityQueue.enqueue(3, -2)
    expect(priorityQueue.buckets).toBe(3)
    expect(priorityQueue.size).toBe(6)
    expect(priorityQueue.maxSize).toBe(6)
    let rtItem = priorityQueue.dequeue(3)
    expect(priorityQueue.buckets).toBe(2)
    expect(priorityQueue.size).toBe(5)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(3)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: -1 },
      { data: 3, priority: 0 },
      { data: 1, priority: 1 }
    ])
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(2)
    expect(priorityQueue.size).toBe(4)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(1)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 2, priority: 0 },
      { data: 3, priority: -1 },
      { data: 3, priority: 0 },
      { data: 1, priority: 1 }
    ])
    rtItem = priorityQueue.dequeue(2)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(3)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 2, priority: 0 },
      { data: 3, priority: -1 },
      { data: 1, priority: 1 }
    ])
    rtItem = priorityQueue.dequeue(2)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(1)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 2, priority: 0 },
      { data: 3, priority: -1 }
    ])
    rtItem = priorityQueue.dequeue(2)
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(2)
    expect(priorityQueue.nodeArray).toStrictEqual([{ data: 3, priority: -1 }])
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.buckets).toBe(0)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(6)
    expect(rtItem).toBe(3)
    expect(priorityQueue.nodeArray).toStrictEqual([])
  })

  it('Verify delete() behavior', () => {
    const priorityQueue = new PriorityQueue()
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.delete(2)).toBe(true)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 3, priority: 0 }
    ])
    expect(priorityQueue.delete(3)).toBe(true)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.nodeArray).toStrictEqual([{ data: 1, priority: 0 }])
    expect(priorityQueue.delete(1)).toBe(true)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.nodeArray).toStrictEqual([])
    expect(priorityQueue.delete(2)).toBe(false)
  })

  it('Verify peekFirst() behavior', () => {
    const priorityQueue = new PriorityQueue()
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.peekFirst()).toBe(1)
    expect(priorityQueue.size).toBe(3)
  })

  it('Verify peekLast() behavior', () => {
    const priorityQueue = new PriorityQueue()
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.peekLast()).toBe(3)
    expect(priorityQueue.size).toBe(3)
  })

  it('Verify iterator behavior', () => {
    const priorityQueue = new PriorityQueue()
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
    const priorityQueue = new PriorityQueue()
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 }
    ])
    priorityQueue.clear()
    expect(priorityQueue.buckets).toBe(1)
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(0)
    expect(priorityQueue.nodeArray).toStrictEqual([])
  })
})
