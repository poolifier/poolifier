import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
} from '../../lib/index.mjs'
import { createPoolCleanup } from './crash-recovery-utils.mjs'

describe('Listener error drain ownership regression test suite', () => {
  const { cleanupPools, trackPool } = createPoolCleanup()

  afterEach(cleanupPools)

  it('crash-first listener throws transfer to overlapping full destroy', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const handlerError = new Error('crash-first error handler throw')
    const exitError = new Error('crash-first exit handler throw')
    const poolError = new Error('crash-first pool error listener throw')
    const queuedRethrows = []
    const lifecycle = { workerNode: undefined }
    const pool = trackPool(
      new FixedThreadPool(2, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
        errorHandler: function () {
          if (this === lifecycle.workerNode.worker) throw handlerError
        },
        exitHandler: function () {
          if (this === lifecycle.workerNode.worker) throw exitError
        },
        restartWorkerOnError: false,
        tasksQueueOptions: { concurrency: 1, tasksFinishedTimeout: 500 },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const crashingWorkerNode = pool.workerNodes[0]
    lifecycle.workerNode = crashingWorkerNode
    const crashingWorkerId = crashingWorkerNode.info.id
    pool.emitter.on(PoolEvents.error, error => {
      if (
        error instanceof WorkerCrashError &&
        error.workerId === crashingWorkerId
      ) {
        throw poolError
      }
    })
    const expectedThrowCount = 3
    let resolveAllExpectedThrows
    const allExpectedThrows = new Promise(resolve => {
      resolveAllExpectedThrows = resolve
    })
    const nativeQueueMicrotask = globalThis.queueMicrotask
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation(callback => {
        nativeQueueMicrotask(() => {
          try {
            callback()
          } catch (error) {
            queuedRethrows.push({
              destroying: pool.destroying,
              error,
              ready: pool.info.ready,
              started: pool.started,
              workerNodes: pool.workerNodes.length,
            })
            if (queuedRethrows.length === expectedThrowCount) {
              resolveAllExpectedThrows()
            }
          }
        })
      })
    try {
      const busy = new Promise(resolve => {
        pool.emitter.once(PoolEvents.busy, resolve)
      })
      const tasks = [pool.execute(), pool.execute()]
      await busy

      const outcomesPromise = Promise.allSettled(tasks)
      const workerExit = new Promise(resolve => {
        crashingWorkerNode.worker.once('exit', resolve)
      })
      crashingWorkerNode.worker.emit(
        'error',
        new Error('crash-first synthetic crash')
      )
      const workerTermination = crashingWorkerNode.worker.terminate()
      await workerExit
      const destroyPromise = pool.destroy()
      const outcomes = await outcomesPromise
      await workerTermination
      await destroyPromise
      await allExpectedThrows

      expect(outcomes.every(outcome => outcome.status === 'rejected')).toBe(
        true
      )
      expect(queuedRethrows.map(record => record.error)).toStrictEqual(
        expect.arrayContaining([handlerError, exitError, poolError])
      )
      expect(new Set(queuedRethrows.map(record => record.error)).size).toBe(3)
      expect(
        queuedRethrows.every(
          record =>
            !record.destroying &&
            !record.started &&
            !record.ready &&
            record.workerNodes === 0
        )
      ).toBe(true)
    } finally {
      queueMicrotaskSpy.mockRestore()
    }
  })

  it('standalone destroy-first listener throw transfers to full destroy', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const exitError = new Error('standalone-first exit handler throw')
    const queuedRethrows = []
    const lifecycle = { workerNode: undefined }
    const pool = trackPool(
      new FixedThreadPool(2, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
        exitHandler: function () {
          if (this === lifecycle.workerNode.worker) throw exitError
        },
        tasksQueueOptions: { concurrency: 1, tasksFinishedTimeout: 500 },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const peerTask = pool.execute()
    const standaloneWorkerNode = pool.workerNodes.find(
      workerNode => workerNode.usage.tasks.executing === 0
    )
    if (standaloneWorkerNode == null) throw new Error('Idle worker not found')
    lifecycle.workerNode = standaloneWorkerNode
    let resolveAllExpectedThrows
    const allExpectedThrows = new Promise(resolve => {
      resolveAllExpectedThrows = resolve
    })
    const nativeQueueMicrotask = globalThis.queueMicrotask
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation(callback => {
        nativeQueueMicrotask(() => {
          try {
            callback()
          } catch (error) {
            queuedRethrows.push({
              destroying: pool.destroying,
              error,
              ready: pool.info.ready,
              started: pool.started,
              workerNodes: pool.workerNodes.length,
            })
            if (queuedRethrows.length === 1) resolveAllExpectedThrows()
          }
        })
      })
    try {
      const workerTerminated = new Promise(resolve => {
        standaloneWorkerNode.once('terminated', resolve)
      })
      const standaloneDestroy = pool.destroyWorkerNode(
        pool.workerNodes.indexOf(standaloneWorkerNode)
      )
      expect(standaloneWorkerNode.info.terminating).toBe(true)
      await workerTerminated
      const fullDestroy = pool.destroy()
      const [taskOutcome, standaloneOutcome, fullOutcome] =
        await Promise.allSettled([peerTask, standaloneDestroy, fullDestroy])
      await allExpectedThrows

      expect(taskOutcome.status).toBe('rejected')
      expect(standaloneOutcome.status).toBe('fulfilled')
      expect(fullOutcome.status).toBe('fulfilled')
      expect(queuedRethrows[0].error).toBe(exitError)
      expect(queuedRethrows[0]).toMatchObject({
        destroying: false,
        ready: false,
        started: false,
        workerNodes: 0,
      })
    } finally {
      queueMicrotaskSpy.mockRestore()
    }
  })
})
