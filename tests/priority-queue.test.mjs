import { expect } from 'expect'

// eslint-disable-next-line n/no-missing-import, import/no-unresolved
import { PriorityQueue } from '../lib/priority-queue.cjs'

describe.skip('Priority queue test suite', () => {
  it('Verify enqueue() behavior', () => {
    const priorityQueue = new PriorityQueue()
    let rtSize = priorityQueue.enqueue(1)
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(1)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([{ data: 1, priority: 0 }])
    rtSize = priorityQueue.enqueue(2)
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(2)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 }
    ])
    rtSize = priorityQueue.enqueue(3)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtSize).toBe(priorityQueue.size)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 }
    ])
    rtSize = priorityQueue.enqueue(3, -1)
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

  it('Verify dequeue() behavior', () => {
    const priorityQueue = new PriorityQueue()
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2, -1)
    priorityQueue.enqueue(3)
    let rtItem = priorityQueue.dequeue()
    expect(priorityQueue.size).toBe(2)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtItem).toBe(2)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 3, priority: 0 }
    ])
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.size).toBe(1)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtItem).toBe(1)
    expect(priorityQueue.nodeArray).toStrictEqual([{ data: 3, priority: 0 }])
    rtItem = priorityQueue.dequeue()
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(3)
    expect(rtItem).toBe(3)
    expect(priorityQueue.nodeArray).toStrictEqual([])
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

  it('Verify clear() behavior', () => {
    const priorityQueue = new PriorityQueue()
    priorityQueue.enqueue(1)
    priorityQueue.enqueue(2)
    priorityQueue.enqueue(3)
    expect(priorityQueue.size).toBe(3)
    expect(priorityQueue.maxSize).toBe(3)
    expect(priorityQueue.nodeArray).toStrictEqual([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 }
    ])
    priorityQueue.clear()
    expect(priorityQueue.size).toBe(0)
    expect(priorityQueue.maxSize).toBe(0)
    expect(priorityQueue.nodeArray).toStrictEqual([])
  })
})
