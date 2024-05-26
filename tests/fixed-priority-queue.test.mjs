// import { expect } from 'expect'

// import {
//   defaultQueueSize,
//   FixedPriorityQueue
// } from '../lib/fixed-priority-queue.cjs'

// describe('Fixed priority queue test suite', () => {
//   it('Verify constructor() behavior', () => {
//     expect(() => new FixedPriorityQueue('')).toThrow(
//       new TypeError('Invalid fixed priority queue size: '' is not an integer')
//     )
//     expect(() => new FixedPriorityQueue(-1)).toThrow(
//       new RangeError('Invalid fixed priority queue size: -1 < 0')
//     )
//     let fixedPriorityQueue = new FixedPriorityQueue()
//     expect(fixedPriorityQueue.start).toBe(0)
//     expect(fixedPriorityQueue.size).toBe(0)
//     expect(fixedPriorityQueue.maxSize).toBe(0)
//     expect(fixedPriorityQueue.nodeArray).toBeInstanceOf(Array)
//     expect(fixedPriorityQueue.nodeArray.length).toBe(defaultQueueSize)
//     fixedPriorityQueue = new FixedPriorityQueue(2)
//     expect(fixedPriorityQueue.start).toBe(0)
//     expect(fixedPriorityQueue.size).toBe(0)
//     expect(fixedPriorityQueue.maxSize).toBe(0)
//     expect(fixedPriorityQueue.nodeArray).toBeInstanceOf(Array)
//     expect(fixedPriorityQueue.nodeArray.length).toBe(2)
//   })

//   it('Verify enqueue() behavior', () => {
//     const queueSize = 5
//     const fixedPriorityQueue = new FixedPriorityQueue(queueSize)
//     let rtSize = fixedPriorityQueue.enqueue(1)
//     expect(fixedPriorityQueue.start).toBe(0)
//     expect(fixedPriorityQueue.size).toBe(1)
//     expect(fixedPriorityQueue.maxSize).toBe(1)
//     expect(rtSize).toBe(fixedPriorityQueue.size)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 1, priority: 0 }
//     ])
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//     rtSize = fixedPriorityQueue.enqueue(2)
//     expect(fixedPriorityQueue.start).toBe(0)
//     expect(fixedPriorityQueue.size).toBe(2)
//     expect(fixedPriorityQueue.maxSize).toBe(2)
//     expect(rtSize).toBe(fixedPriorityQueue.size)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 1, priority: 0 },
//       { data: 2, priority: 0 }
//     ])
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//     rtSize = fixedPriorityQueue.enqueue(3)
//     expect(fixedPriorityQueue.start).toBe(0)
//     expect(fixedPriorityQueue.size).toBe(3)
//     expect(fixedPriorityQueue.maxSize).toBe(3)
//     expect(rtSize).toBe(fixedPriorityQueue.size)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 1, priority: 0 },
//       { data: 2, priority: 0 },
//       { data: 3, priority: 0 }
//     ])
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//     rtSize = fixedPriorityQueue.enqueue(3, -1)
//     expect(fixedPriorityQueue.start).toBe(0)
//     expect(fixedPriorityQueue.size).toBe(4)
//     expect(fixedPriorityQueue.maxSize).toBe(4)
//     expect(rtSize).toBe(fixedPriorityQueue.size)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 3, priority: -1 },
//       { data: 1, priority: 0 },
//       { data: 2, priority: 0 },
//       { data: 3, priority: 0 }
//     ])
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//     rtSize = fixedPriorityQueue.enqueue(1, 1)
//     expect(fixedPriorityQueue.start).toBe(0)
//     expect(fixedPriorityQueue.size).toBe(5)
//     expect(fixedPriorityQueue.maxSize).toBe(5)
//     expect(rtSize).toBe(fixedPriorityQueue.size)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 3, priority: -1 },
//       { data: 1, priority: 0 },
//       { data: 2, priority: 0 },
//       { data: 3, priority: 0 },
//       { data: 1, priority: 1 }
//     ])
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//     expect(() => fixedPriorityQueue.enqueue(4)).toThrow(
//       new Error('Priority queue is full')
//     )
//   })

//   it('Verify dequeue() behavior', () => {
//     const queueSize = 5
//     const fixedPriorityQueue = new FixedPriorityQueue(queueSize)
//     fixedPriorityQueue.enqueue(1)
//     fixedPriorityQueue.enqueue(2, -1)
//     fixedPriorityQueue.enqueue(3)
//     expect(fixedPriorityQueue.start).toBe(0)
//     expect(fixedPriorityQueue.size).toBe(3)
//     expect(fixedPriorityQueue.maxSize).toBe(3)
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//     let rtItem = fixedPriorityQueue.dequeue()
//     expect(fixedPriorityQueue.start).toBe(1)
//     expect(fixedPriorityQueue.size).toBe(2)
//     expect(fixedPriorityQueue.maxSize).toBe(3)
//     expect(rtItem).toBe(2)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 2, priority: -1 },
//       { data: 1, priority: 0 },
//       { data: 3, priority: 0 }
//     ])
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//     rtItem = fixedPriorityQueue.dequeue()
//     expect(fixedPriorityQueue.start).toBe(2)
//     expect(fixedPriorityQueue.size).toBe(1)
//     expect(fixedPriorityQueue.maxSize).toBe(3)
//     expect(rtItem).toBe(1)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 2, priority: -1 },
//       { data: 1, priority: 0 },
//       { data: 3, priority: 0 }
//     ])
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//     rtItem = fixedPriorityQueue.dequeue()
//     expect(fixedPriorityQueue.start).toBe(3)
//     expect(fixedPriorityQueue.size).toBe(0)
//     expect(fixedPriorityQueue.maxSize).toBe(3)
//     expect(rtItem).toBe(3)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 2, priority: -1 },
//       { data: 1, priority: 0 },
//       { data: 3, priority: 0 }
//     ])
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//     rtItem = fixedPriorityQueue.dequeue()
//     expect(fixedPriorityQueue.start).toBe(3)
//     expect(fixedPriorityQueue.size).toBe(0)
//     expect(fixedPriorityQueue.maxSize).toBe(3)
//     expect(rtItem).toBe(undefined)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 2, priority: -1 },
//       { data: 1, priority: 0 },
//       { data: 3, priority: 0 }
//     ])
//     expect(fixedPriorityQueue.nodeArray.length).toBe(queueSize)
//   })

//   it('Verify iterator behavior', () => {
//     const fixedPriorityQueue = new FixedPriorityQueue()
//     fixedPriorityQueue.enqueue(1)
//     fixedPriorityQueue.enqueue(2)
//     fixedPriorityQueue.enqueue(3)
//     let i = fixedPriorityQueue.start + 1
//     for (const value of fixedPriorityQueue) {
//       expect(value).toBe(i)
//       ++i
//     }
//     fixedPriorityQueue.dequeue()
//     i = fixedPriorityQueue.start + 1
//     for (const value of fixedPriorityQueue) {
//       expect(value).toBe(i)
//       ++i
//     }
//   })

//   it('Verify clear() behavior', () => {
//     const fixedPriorityQueue = new FixedPriorityQueue()
//     fixedPriorityQueue.start = 1
//     fixedPriorityQueue.size = 2
//     fixedPriorityQueue.maxSize = 2
//     fixedPriorityQueue.nodeArray = [
//       { data: 2, priority: 0 },
//       { data: 3, priority: 0 }
//     ]
//     fixedPriorityQueue.clear()
//     expect(fixedPriorityQueue.start).toBe(0)
//     expect(fixedPriorityQueue.size).toBe(0)
//     expect(fixedPriorityQueue.maxSize).toBe(0)
//     expect(fixedPriorityQueue.nodeArray).toMatchObject([
//       { data: 2, priority: 0 },
//       { data: 3, priority: 0 }
//     ])
//   })
// })
