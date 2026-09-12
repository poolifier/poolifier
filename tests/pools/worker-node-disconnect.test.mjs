import { describe, expect, it, vi } from 'vitest'

import { FixedClusterPool, PoolEvents } from '../../lib/index.mjs'

describe('Worker node disconnect completion', () => {
  it.each([
    ['successful kill', undefined],
    [
      'ESRCH',
      Object.assign(new Error('cluster worker already exited'), {
        code: 'ESRCH',
      }),
    ],
  ])(
    'Worker node terminate() owns disconnect-event %s',
    { retry: 0, timeout: 5_000 },
    async (_, killFailure) => {
      // Given a supported cluster pool whose real disconnect event reaches kill()
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
      const processListenerCounts = {
        exception: process.listenerCount('uncaughtException'),
        rejection: process.listenerCount('unhandledRejection'),
      }
      const killSpy = vi
        .spyOn(workerNode.worker, 'kill')
        .mockImplementation(() => {
          if (killFailure != null) throw killFailure
          return true
        })
      let notifications = 0
      workerNode.on('terminated', () => {
        ++notifications
      })
      try {
        // When the native disconnect callback invokes kill()
        await expect(workerNode.terminate()).resolves.toBeUndefined()

        // Then completion is owned and leaves no pending termination resource
        expect(killSpy).toHaveBeenCalledTimes(1)
        expect(notifications).toBe(1)
        expect(workerNode.messageChannel).toBeUndefined()
        expect(workerNode.worker.eventNames()).toStrictEqual([])
        expect(workerNode.eventNames()).toStrictEqual([])
        expect(process.listenerCount('unhandledRejection')).toBe(
          processListenerCounts.rejection
        )
        expect(process.listenerCount('uncaughtException')).toBe(
          processListenerCounts.exception
        )
      } finally {
        killSpy.mockRestore()
        nativeKill()
      }
    }
  )

  it.each([
    [
      'EACCES',
      Object.assign(new Error('cluster worker kill denied'), {
        code: 'EACCES',
      }),
    ],
    ['a unique object', { marker: 'unique-disconnect-kill-failure' }],
  ])(
    'Worker node terminate() rejects disconnect-event %s by exact identity',
    { retry: 0, timeout: 5_000 },
    async (_, killFailure) => {
      // Given a supported cluster pool whose disconnect-event kill throws
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
      const killSpy = vi
        .spyOn(workerNode.worker, 'kill')
        .mockImplementation(() => {
          throw killFailure
        })
      let notifications = 0
      workerNode.on('terminated', () => {
        ++notifications
      })
      try {
        // When the real disconnect callback invokes kill()
        await expect(workerNode.terminate()).rejects.toBe(killFailure)

        // Then rejection occurs only after complete, single-attempt cleanup
        expect(killSpy).toHaveBeenCalledTimes(1)
        expect(notifications).toBe(1)
        expect(workerNode.messageChannel).toBeUndefined()
        expect(workerNode.worker.eventNames()).toStrictEqual([])
        expect(workerNode.eventNames()).toStrictEqual([])
      } finally {
        killSpy.mockRestore()
        nativeKill()
      }
    }
  )

  it('Worker node terminate() preserves disconnect kill failure over notification failure', {
    retry: 0,
    timeout: 5_000,
  }, async () => {
    // Given disconnect kill and termination notification both throw
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
    const killFailure = { marker: 'first-disconnect-kill-failure' }
    const notificationFailure = new Error('termination notification failed')
    const killSpy = vi
      .spyOn(workerNode.worker, 'kill')
      .mockImplementation(() => {
        throw killFailure
      })
    let notifications = 0
    workerNode.on('terminated', () => {
      ++notifications
      throw notificationFailure
    })
    try {
      // When the real disconnect callback invokes kill()
      await expect(workerNode.terminate()).rejects.toBe(killFailure)

      // Then the first error wins and notification is attempted exactly once
      expect(killSpy).toHaveBeenCalledTimes(1)
      expect(notifications).toBe(1)
      expect(workerNode.messageChannel).toBeUndefined()
      expect(workerNode.worker.eventNames()).toStrictEqual([])
      expect(workerNode.eventNames()).toStrictEqual([])
    } finally {
      killSpy.mockRestore()
      nativeKill()
    }
  })
})
