import { describe, expect, it, vi } from 'vitest'

import { WorkerTypes } from '../../lib/index.mjs'
import { WorkerNode } from '../../lib/pools/worker-node.mjs'

describe('Worker node notification failures', () => {
  it.each([
    ['port unref Error', 'unref', new Error('port unref failed')],
    ['port unref non-Error', 'unref', { marker: 'port-unref-failure' }],
    ['port close Error', 'close', new Error('port close failed')],
    ['port close non-Error', 'close', { marker: 'port-close-failure' }],
  ])(
    'Worker node terminate() preserves the first %s while completing teardown',
    {
      retry: 0,
    },
    async (_name, failingOperation, channelError) => {
      // Given every teardown stage fails after the selected channel operation
      const workerNode = new WorkerNode(
        WorkerTypes.thread,
        './tests/worker-files/thread/testWorker.mjs',
        {
          tasksQueueBackPressureSize: 12,
          tasksQueueBucketSize: 6,
          tasksQueuePriority: true,
        }
      )
      const nativeTerminate = workerNode.worker.terminate.bind(
        workerNode.worker
      )
      const messageChannel = workerNode.messageChannel
      const nativeError = new Error('native terminate failed')
      const notificationError = new Error('terminated notification failed')
      const port1UnrefSpy = vi.spyOn(messageChannel.port1, 'unref')
      const port2UnrefSpy = vi.spyOn(messageChannel.port2, 'unref')
      const port1CloseSpy = vi.spyOn(messageChannel.port1, 'close')
      const port2CloseSpy = vi.spyOn(messageChannel.port2, 'close')
      const failingSpy =
        failingOperation === 'unref' ? port1UnrefSpy : port1CloseSpy
      failingSpy.mockImplementation(() => {
        throw channelError
      })
      const terminateSpy = vi
        .spyOn(workerNode.worker, 'terminate')
        .mockImplementation(() => {
          throw nativeError
        })
      let notifications = 0
      workerNode.on('terminated', () => {
        ++notifications
        throw notificationError
      })

      try {
        // When termination is initiated
        await expect(workerNode.terminate()).rejects.toBe(channelError)

        // Then all teardown actions run once and the first failure wins
        expect(port1UnrefSpy).toHaveBeenCalledTimes(1)
        expect(port2UnrefSpy).toHaveBeenCalledTimes(1)
        expect(port1CloseSpy).toHaveBeenCalledTimes(1)
        expect(port2CloseSpy).toHaveBeenCalledTimes(1)
        expect(terminateSpy).toHaveBeenCalledTimes(1)
        expect(notifications).toBe(1)
        expect(workerNode.messageChannel).toBeUndefined()
        expect(workerNode.worker.eventNames()).toStrictEqual([])
        expect(workerNode.eventNames()).toStrictEqual([])
      } finally {
        vi.restoreAllMocks()
        await nativeTerminate()
      }
    }
  )

  it('Worker node terminate() preserves a raw invocation error over notification errors', {
    retry: 0,
  }, async () => {
    // Given raw terminate() and the termination notification both throw
    const workerNode = new WorkerNode(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      }
    )
    const invocationError = new Error('raw terminate invocation failed')
    const listenerError = new Error('terminated listener failed')
    const terminateSpy = vi
      .spyOn(workerNode.worker, 'terminate')
      .mockImplementation(() => {
        throw invocationError
      })
    let notifications = 0
    workerNode.on('terminated', () => {
      ++notifications
      throw listenerError
    })

    // When termination is initiated
    await expect(workerNode.terminate()).rejects.toBe(invocationError)

    // Then setup failure has precedence and notification is attempted once
    expect(notifications).toBe(1)
    expect(workerNode.messageChannel).toBeUndefined()
    expect(workerNode.worker.eventNames()).toStrictEqual([])
    expect(workerNode.eventNames()).toStrictEqual([])
    terminateSpy.mockRestore()
    await workerNode.worker.terminate()
  })

  it('Worker node terminate() preserves graceful initiation failure over hard-stop and notification failures', {
    retry: 0,
  }, async () => {
    // Given graceful initiation, native hard stop, and notification all fail
    const workerNode = new WorkerNode(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      }
    )
    const nativeTerminate = workerNode.worker.terminate.bind(workerNode.worker)
    const initiationError = { marker: 'primary-unref-failure' }
    const hardStopError = { marker: 'secondary-terminate-failure' }
    const notificationError = { marker: 'tertiary-notification-failure' }
    const unrefSpy = vi
      .spyOn(workerNode.worker, 'unref')
      .mockImplementation(() => {
        throw initiationError
      })
    const terminateSpy = vi
      .spyOn(workerNode.worker, 'terminate')
      .mockImplementation(() => {
        throw hardStopError
      })
    let notifications = 0
    workerNode.on('terminated', () => {
      ++notifications
      throw notificationError
    })

    try {
      // When termination owns all three failures
      await expect(workerNode.terminate()).rejects.toBe(initiationError)

      // Then the first failure wins and hard stop/publication are attempted once
      expect(terminateSpy).toHaveBeenCalledTimes(1)
      expect(notifications).toBe(1)
      expect(workerNode.messageChannel).toBeUndefined()
      expect(workerNode.worker.eventNames()).toStrictEqual([])
      expect(workerNode.eventNames()).toStrictEqual([])
    } finally {
      unrefSpy.mockRestore()
      terminateSpy.mockRestore()
      await nativeTerminate()
    }
  })

  it('Worker node terminate() cleans the already-exited path after a notification error', {
    retry: 0,
  }, async () => {
    // Given an already-exited node with a throwing termination listener
    const workerNode = new WorkerNode(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      }
    )
    const listenerError = new Error('already-exited listener failed')
    workerNode.exited = true
    let notifications = 0
    workerNode.on('terminated', () => {
      ++notifications
      throw listenerError
    })

    // When the already-exited fast path emits its notification
    await expect(workerNode.terminate()).rejects.toBe(listenerError)

    // Then that exact listener error propagates after complete cleanup
    expect(notifications).toBe(1)
    expect(workerNode.messageChannel).toBeUndefined()
    expect(workerNode.worker.eventNames()).toStrictEqual([])
    expect(workerNode.eventNames()).toStrictEqual([])
    await workerNode.worker.terminate()
  })

  it('Worker node terminate() clears the active grace timer before propagating a notification error', {
    retry: 0,
  }, async () => {
    // Given an active worker with a throwing termination listener
    const workerNode = new WorkerNode(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      }
    )
    const listenerError = new Error('active listener failed')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    let notifications = 0
    workerNode.on('terminated', () => {
      ++notifications
      throw listenerError
    })

    // When active termination reaches final notification
    await expect(workerNode.terminate()).rejects.toBe(listenerError)

    // Then the listener error propagates only after timer and listener cleanup
    expect(notifications).toBe(1)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(workerNode.messageChannel).toBeUndefined()
    expect(workerNode.worker.eventNames()).toStrictEqual([])
    expect(workerNode.eventNames()).toStrictEqual([])
    clearTimeoutSpy.mockRestore()
  })
})
