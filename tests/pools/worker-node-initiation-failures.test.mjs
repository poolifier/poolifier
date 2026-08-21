import { describe, expect, it, vi } from 'vitest'

import { FixedClusterPool, PoolEvents, WorkerTypes } from '../../lib/index.mjs'
import { WorkerNode } from '../../lib/pools/worker-node.mjs'

describe('Worker node initiation failures', () => {
  it('Worker node terminate() cleans up after cluster disconnect throws', {
    retry: 0,
  }, async () => {
    // Given a supported cluster pool whose disconnect initiation throws
    const pool = new FixedClusterPool(
      1,
      './tests/worker-files/cluster/testWorker.cjs',
      { errorHandler: () => undefined }
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const workerNode = pool.workerNodes[0]
    const disconnectError = { marker: 'disconnect initiation failed' }
    const disconnectSpy = vi
      .spyOn(workerNode.worker, 'disconnect')
      .mockImplementation(() => {
        throw disconnectError
      })
    const killSpy = vi.spyOn(workerNode.worker, 'kill')
    let deadAtNotification = false
    let notifications = 0
    workerNode.on('terminated', () => {
      ++notifications
      deadAtNotification = workerNode.worker.isDead()
    })

    try {
      // When termination is initiated
      await expect(workerNode.terminate()).rejects.toBe(disconnectError)

      // Then hard stop completes before cleanup and publication
      expect(killSpy).toHaveBeenCalledTimes(1)
      expect(deadAtNotification).toBe(true)
      expect(workerNode.worker.isDead()).toBe(true)
      expect(notifications).toBe(1)
      expect(workerNode.worker.eventNames()).toStrictEqual([])
      expect(workerNode.eventNames()).toStrictEqual([])
    } finally {
      disconnectSpy.mockRestore()
      killSpy.mockRestore()
    }
  })

  it.each([
    [
      'ESRCH',
      Object.assign(new Error('cluster worker already exited'), {
        code: 'ESRCH',
      }),
    ],
    ['an unknown value', { marker: 'secondary-kill-failure' }],
  ])(
    'Worker node terminate() preserves disconnect initiation failure when fallback kill throws %s',
    { retry: 0 },
    async (_, hardStopError) => {
      // Given disconnect initiation and its owned fallback kill both fail
      const pool = new FixedClusterPool(
        1,
        './tests/worker-files/cluster/testWorker.cjs',
        { errorHandler: () => undefined }
      )
      if (!pool.info.ready) {
        await new Promise(resolve => {
          pool.emitter.once(PoolEvents.ready, resolve)
        })
      }
      const workerNode = pool.workerNodes[0]
      const nativeKill = workerNode.worker.kill.bind(workerNode.worker)
      const initiationError = { marker: 'primary-disconnect-failure' }
      const disconnectSpy = vi
        .spyOn(workerNode.worker, 'disconnect')
        .mockImplementation(() => {
          throw initiationError
        })
      const killSpy = vi
        .spyOn(workerNode.worker, 'kill')
        .mockImplementation(() => {
          throw hardStopError
        })
      let notifications = 0
      workerNode.on('terminated', () => {
        ++notifications
      })

      try {
        // When termination owns both failures
        await expect(workerNode.terminate()).rejects.toBe(initiationError)

        // Then fallback policy cannot replace the primary failure
        expect(killSpy).toHaveBeenCalledTimes(1)
        expect(notifications).toBe(1)
        expect(workerNode.worker.eventNames()).toStrictEqual([])
        expect(workerNode.eventNames()).toStrictEqual([])
      } finally {
        disconnectSpy.mockRestore()
        killSpy.mockRestore()
        nativeKill()
      }
    }
  )

  it('Worker node terminate() cleans up after thread unref throws', {
    retry: 0,
  }, async () => {
    // Given a thread worker whose unref initiation throws synchronously
    const workerNode = new WorkerNode(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      }
    )
    const unrefError = { marker: 'unref initiation failed' }
    const unrefSpy = vi
      .spyOn(workerNode.worker, 'unref')
      .mockImplementation(() => {
        throw unrefError
      })
    const terminateSpy = vi.spyOn(workerNode.worker, 'terminate')
    let deadAtNotification = false
    let notifications = 0
    workerNode.on('terminated', () => {
      ++notifications
      deadAtNotification = workerNode.worker.threadId === -1
    })

    try {
      // When termination is initiated
      await expect(workerNode.terminate()).rejects.toBe(unrefError)

      // Then native terminate settles before cleanup and publication
      expect(terminateSpy).toHaveBeenCalledTimes(1)
      expect(deadAtNotification).toBe(true)
      expect(workerNode.worker.threadId).toBe(-1)
      expect(notifications).toBe(1)
      expect(workerNode.messageChannel).toBeUndefined()
      expect(workerNode.worker.eventNames()).toStrictEqual([])
      expect(workerNode.eventNames()).toStrictEqual([])
    } finally {
      unrefSpy.mockRestore()
      terminateSpy.mockRestore()
    }
  })

  it('Worker node terminate() bounds a hung fallback thread termination by the grace period', {
    retry: 0,
    timeout: 8_000,
  }, async () => {
    // Given unref fails and native terminate stops the worker but its wrapper never settles
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
    const initiationError = { marker: 'bounded-unref-failure' }
    const lateFallbackError = { marker: 'late-fallback-rejection' }
    let rejectFallback
    const hungFallback = new Promise((_resolve, reject) => {
      rejectFallback = reject
    })
    const unrefSpy = vi
      .spyOn(workerNode.worker, 'unref')
      .mockImplementation(() => {
        throw initiationError
      })
    const terminateSpy = vi
      .spyOn(workerNode.worker, 'terminate')
      .mockImplementation(async () => {
        await nativeTerminate()
        return await hungFallback
      })
    const processListenerCounts = {
      exception: process.listenerCount('uncaughtException'),
      rejection: process.listenerCount('unhandledRejection'),
    }
    let deadAtNotification = false
    let notifications = 0
    workerNode.on('terminated', () => {
      ++notifications
      deadAtNotification = workerNode.worker.threadId === -1
    })
    const startedAt = performance.now()

    try {
      // When fallback termination exceeds the existing grace period
      await expect(workerNode.terminate()).rejects.toBe(initiationError)
      const elapsed = performance.now() - startedAt

      // Then primary rejection and cleanup occur within the bounded window
      expect(elapsed).toBeGreaterThanOrEqual(4_500)
      expect(elapsed).toBeLessThan(7_000)
      expect(terminateSpy).toHaveBeenCalledTimes(1)
      expect(deadAtNotification).toBe(true)
      expect(workerNode.worker.threadId).toBe(-1)
      expect(notifications).toBe(1)
      expect(workerNode.messageChannel).toBeUndefined()
      expect(workerNode.worker.eventNames()).toStrictEqual([])
      expect(workerNode.eventNames()).toStrictEqual([])

      // And a losing fallback rejection remains observed after timeout wins
      rejectFallback(lateFallbackError)
      await new Promise(resolve => setImmediate(resolve))
      expect(process.listenerCount('uncaughtException')).toBe(
        processListenerCounts.exception
      )
      expect(process.listenerCount('unhandledRejection')).toBe(
        processListenerCounts.rejection
      )
    } finally {
      terminateSpy.mockRestore()
      unrefSpy.mockRestore()
    }
  })
})
