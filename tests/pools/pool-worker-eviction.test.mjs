import { AsyncResource } from 'node:async_hooks'
import { getEventListeners } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DynamicThreadPool,
  FixedThreadPool,
  PoolEvents,
  WorkerTerminationError,
} from '../../lib/index.mjs'
import { collectRejection, createPoolCleanup } from './crash-recovery-utils.mjs'

describe('Pool worker eviction', () => {
  const { cleanupPools, trackPool } = createPoolCleanup()
  afterEach(cleanupPools)

  it('dynamic worker idle eviction (no in-flight) does NOT emit error events', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new DynamicThreadPool(
        1,
        2,
        './tests/worker-files/thread/testWorker.mjs',
        { errorHandler: () => undefined }
      )
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const errorEvents = []
    pool.emitter.on(PoolEvents.error, error => {
      errorEvents.push(error)
    })
    const destroyWorkerNodeSpy = vi.spyOn(pool, 'destroyWorkerNode')
    const poolFull = new Promise(resolve => {
      pool.emitter.once(PoolEvents.full, resolve)
    })
    const promises = [pool.execute(), pool.execute()]
    await poolFull
    expect(pool.workerNodes).toHaveLength(2)
    expect(pool.info.executingTasks).toBe(2)
    const dynamicWorker = pool.workerNodes.find(
      workerNode => workerNode.info.dynamic
    )
    const workerTerminated = new Promise(resolve => {
      dynamicWorker.worker.once('exit', resolve)
    })
    await Promise.all(promises)
    await workerTerminated
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.workerNodes).toHaveLength(1)
    expect(errorEvents.length).toBe(0)
    expect(destroyWorkerNodeSpy).toHaveBeenCalledTimes(1)
  })

  it('dynamic-eviction destroyWorkerNode WITH in-flight task rejects via WorkerTerminationError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new DynamicThreadPool(
        1,
        2,
        './tests/worker-files/thread/hangWorker.mjs',
        {
          enableTasksQueue: true,
          restartWorkerOnError: false,
          tasksQueueOptions: { tasksFinishedTimeout: 100 },
        }
      )
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const rejections = []
    const promise = collectRejection(pool.execute(), rejections)
    expect(pool.info.executingTasks).toBe(1)
    expect(
      pool.workerNodes.some(workerNode => workerNode.usage.tasks.executing > 0)
    ).toBe(true)
    const targetKey = pool.workerNodes.findIndex(
      workerNode => workerNode.usage.tasks.executing > 0
    )
    if (targetKey !== -1) {
      await pool.destroyWorkerNode(targetKey)
    }
    await Promise.allSettled([promise])
    expect(rejections.length).toBe(1)
    expect(rejections[0]).toBeInstanceOf(WorkerTerminationError)
    expect(rejections[0].name).toBe('WorkerTerminationError')
    expect(rejections[0].taskId).toBeDefined()
  })

  it('queued abort rejects through async resource cleanup', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/hangWorker.mjs', {
        enableTasksQueue: true,
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const poolBusy = new Promise(resolve => {
      pool.emitter.once(PoolEvents.busy, resolve)
    })
    const inFlightOutcome = Promise.allSettled([pool.execute()])
    await poolBusy
    const abortController = new AbortController()
    const emitDestroySpy = vi.spyOn(AsyncResource.prototype, 'emitDestroy')
    const queued = pool.execute(undefined, undefined, abortController.signal)
    expect(pool.info.executingTasks + pool.info.queuedTasks).toBe(2)
    expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
    expect(pool.workerNodes[0].tasksQueueSize()).toBe(1)
    const abortReason = new Error('Queued task aborted')
    abortController.abort(abortReason)
    let queuedRejected
    try {
      await queued
    } catch (error) {
      queuedRejected = error
    }
    expect(queuedRejected).toBeInstanceOf(Error)
    expect(emitDestroySpy).toHaveBeenCalledTimes(1)
    expect(pool.info.queuedTasks).toBe(0)
    expect(queuedRejected).toBe(abortReason)
    await pool.destroy()
    const [inFlight] = await inFlightOutcome
    expect(inFlight.status).toBe('rejected')
    expect(inFlight.reason).toBeInstanceOf(WorkerTerminationError)
  })

  it('destroyWorkerNode redistributes queued work with single abort cleanup', {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(2, './tests/worker-files/thread/asyncWorker.mjs', {
        enableTasksQueue: true,
        errorHandler: () => undefined,
        tasksQueueOptions: { concurrency: 1, tasksFinishedTimeout: 1000 },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const terminating = collectRejection(
      pool.execute({ terminating: true }),
      []
    )
    const peer = pool.execute({ peer: true })
    const abortController = new AbortController()
    const abortReason = new Error('Queued task aborted before worker drain')
    const aborted = pool.execute(
      { sequence: 1 },
      undefined,
      abortController.signal
    )
    const redistributed = Promise.all([
      pool.execute({ sequence: 2 }),
      pool.execute({ sequence: 3 }),
    ])
    expect(pool.info).toMatchObject({ executingTasks: 2, queuedTasks: 3 })

    abortController.abort(abortReason)
    await expect(aborted).rejects.toBe(abortReason)
    expect(pool.info.queuedTasks).toBe(2)
    await pool.destroyWorkerNode(0)

    await expect(redistributed).resolves.toEqual([
      { sequence: 2 },
      { sequence: 3 },
    ])
    await Promise.allSettled([terminating, peer])
    expect(getEventListeners(abortController.signal, 'abort')).toHaveLength(0)
    expect(pool.info).toMatchObject({
      executedTasks: 3,
      executingTasks: 0,
      failedTasks: 1,
      queuedTasks: 0,
    })
  })
})
