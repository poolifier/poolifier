import { expect } from 'expect'

import { FixedPriorityQueue } from '../lib/fixed-priority-queue.cjs'
import { defaultQueueSize } from '../lib/utility-types.cjs'

describe('Fixed priority queue test suite', () => {
  it('Verify constructor() behavior', () => {
    expect(() => new FixedPriorityQueue('')).toThrow(
      new TypeError("Invalid fixed priority queue size: '' is not an integer")
    )
    expect(() => new FixedPriorityQueue(-1)).toThrow(
      new RangeError('Invalid fixed priority queue size: -1 < 0')
    )
    const fixedPriorityQueue = new FixedPriorityQueue()
    expect(fixedPriorityQueue.start).toBe(0)
    expect(fixedPriorityQueue.size).toBe(0)
    expect(fixedPriorityQueue.nodeArray).toBeInstanceOf(Array)
    expect(fixedPriorityQueue.capacity).toBe(defaultQueueSize)
  })

  it('Verify enqueue() behavior', () => {
    const queueSize = 5
    const fixedPriorityQueue = new FixedPriorityQueue(queueSize)
    let rtSize = fixedPriorityQueue.enqueue(1)
    expect(fixedPriorityQueue.start).toBe(0)
    expect(fixedPriorityQueue.size).toBe(1)
    expect(rtSize).toBe(fixedPriorityQueue.size)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
    ])
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
    rtSize = fixedPriorityQueue.enqueue(2)
    expect(fixedPriorityQueue.start).toBe(0)
    expect(fixedPriorityQueue.size).toBe(2)
    expect(rtSize).toBe(fixedPriorityQueue.size)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
    ])
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
    rtSize = fixedPriorityQueue.enqueue(3)
    expect(fixedPriorityQueue.start).toBe(0)
    expect(fixedPriorityQueue.size).toBe(3)
    expect(rtSize).toBe(fixedPriorityQueue.size)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
    rtSize = fixedPriorityQueue.enqueue(3, -1)
    expect(fixedPriorityQueue.start).toBe(0)
    expect(fixedPriorityQueue.size).toBe(4)
    expect(rtSize).toBe(fixedPriorityQueue.size)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 3, priority: -1 },
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
    rtSize = fixedPriorityQueue.enqueue(1, 1)
    expect(fixedPriorityQueue.start).toBe(0)
    expect(fixedPriorityQueue.size).toBe(5)
    expect(rtSize).toBe(fixedPriorityQueue.size)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 3, priority: -1 },
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
      { data: 1, priority: 1 },
    ])
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
    expect(() => fixedPriorityQueue.enqueue(4)).toThrow(
      new Error('Fixed priority queue is full')
    )
  })

  it('Verify get() behavior', () => {
    const fixedPriorityQueue = new FixedPriorityQueue()
    fixedPriorityQueue.enqueue(1)
    fixedPriorityQueue.enqueue(2, -1)
    fixedPriorityQueue.enqueue(3)
    expect(fixedPriorityQueue.get(0)).toBe(2)
    expect(fixedPriorityQueue.get(1)).toBe(1)
    expect(fixedPriorityQueue.get(2)).toBe(3)
    expect(fixedPriorityQueue.get(3)).toBe(undefined)
  })

  it('Verify dequeue() behavior', () => {
    const queueSize = 5
    const fixedPriorityQueue = new FixedPriorityQueue(queueSize)
    fixedPriorityQueue.enqueue(1)
    fixedPriorityQueue.enqueue(2, -1)
    fixedPriorityQueue.enqueue(3)
    expect(fixedPriorityQueue.start).toBe(0)
    expect(fixedPriorityQueue.size).toBe(3)
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
    let rtItem = fixedPriorityQueue.dequeue()
    expect(fixedPriorityQueue.start).toBe(1)
    expect(fixedPriorityQueue.size).toBe(2)
    expect(rtItem).toBe(2)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 2, priority: -1 },
      { data: 1, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
    rtItem = fixedPriorityQueue.dequeue()
    expect(fixedPriorityQueue.start).toBe(2)
    expect(fixedPriorityQueue.size).toBe(1)
    expect(rtItem).toBe(1)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 2, priority: -1 },
      { data: 1, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
    rtItem = fixedPriorityQueue.dequeue()
    expect(fixedPriorityQueue.start).toBe(3)
    expect(fixedPriorityQueue.size).toBe(0)
    expect(rtItem).toBe(3)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 2, priority: -1 },
      { data: 1, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
    rtItem = fixedPriorityQueue.dequeue()
    expect(fixedPriorityQueue.start).toBe(3)
    expect(fixedPriorityQueue.size).toBe(0)
    expect(rtItem).toBe(undefined)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 2, priority: -1 },
      { data: 1, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(fixedPriorityQueue.capacity).toBe(queueSize)
  })

  it('Verify iterator behavior', () => {
    const fixedPriorityQueue = new FixedPriorityQueue()
    fixedPriorityQueue.enqueue(1)
    fixedPriorityQueue.enqueue(2)
    fixedPriorityQueue.enqueue(3)
    let i = fixedPriorityQueue.start + 1
    for (const value of fixedPriorityQueue) {
      expect(value).toBe(i)
      ++i
    }
    fixedPriorityQueue.dequeue()
    i = fixedPriorityQueue.start + 1
    for (const value of fixedPriorityQueue) {
      expect(value).toBe(i)
      ++i
    }
  })

  it('Verify empty() behavior', () => {
    const fixedPriorityQueue = new FixedPriorityQueue()
    expect(fixedPriorityQueue.empty()).toBe(true)
    fixedPriorityQueue.enqueue(1)
    expect(fixedPriorityQueue.empty()).toBe(false)
    fixedPriorityQueue.dequeue()
    expect(fixedPriorityQueue.empty()).toBe(true)
  })

  it('Verify full() behavior', () => {
    const fixedPriorityQueue = new FixedPriorityQueue(2)
    expect(fixedPriorityQueue.full()).toBe(false)
    fixedPriorityQueue.enqueue(1)
    expect(fixedPriorityQueue.full()).toBe(false)
    fixedPriorityQueue.enqueue(2)
    expect(fixedPriorityQueue.full()).toBe(true)
    fixedPriorityQueue.dequeue()
    expect(fixedPriorityQueue.full()).toBe(false)
  })

  it('Verify clear() behavior', () => {
    const fixedPriorityQueue = new FixedPriorityQueue()
    fixedPriorityQueue.start = 1
    fixedPriorityQueue.size = 2
    fixedPriorityQueue.nodeArray = [
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
    ]
    fixedPriorityQueue.clear()
    expect(fixedPriorityQueue.start).toBe(0)
    expect(fixedPriorityQueue.size).toBe(0)
    expect(fixedPriorityQueue.nodeArray).toMatchObject([
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
    ])
  })
})
