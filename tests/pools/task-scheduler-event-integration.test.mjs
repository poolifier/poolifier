import { AsyncResource } from 'node:async_hooks'
import { getEventListeners } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../lib/index.mjs'
import { createPoolCleanup } from './crash-recovery-utils.mjs'

const nativeQueueMicrotask = globalThis.queueMicrotask.bind(globalThis)
const workerPath = './tests/worker-files/thread/testWorker.mjs'

describe('Task scheduler event integration', () => {
  const { cleanupPools, trackPool } = createPoolCleanup()
  afterEach(async () => {
    vi.restoreAllMocks()
    await cleanupPools()
  })

  const captureQueuedRethrows = () => {
    const queuedRethrows = []
    let resolveQueuedRethrow
    const queuedRethrow = new Promise(resolve => {
      resolveQueuedRethrow = resolve
    })
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(callback => {
      nativeQueueMicrotask(() => {
        try {
          callback()
        } catch (error) {
          queuedRethrows.push(error)
          resolveQueuedRethrow()
        }
      })
    })
    return { queuedRethrow, queuedRethrows }
  }

  it('surfaces a post-commit busy listener separately from the sent task', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(new FixedThreadPool(1, workerPath))
    if (!pool.info.ready) {
      await new Promise(resolve => pool.emitter.once(PoolEvents.ready, resolve))
    }
    await pool.addTaskFunction('identity', data => data)
    const abortController = new AbortController()
    const emitDestroySpy = vi.spyOn(AsyncResource.prototype, 'emitDestroy')
    const listenerError = new Error('busy listener')
    const { queuedRethrow, queuedRethrows } = captureQueuedRethrows()
    pool.emitter.on(PoolEvents.busy, () => {
      throw listenerError
    })

    const result = await pool.execute(
      { value: 42 },
      'identity',
      abortController.signal
    )

    expect(result).toStrictEqual({ value: 42 })
    await queuedRethrow
    expect(pool.info.executingTasks).toBe(0)
    expect(queuedRethrows).toStrictEqual([listenerError])
    expect(getEventListeners(abortController.signal, 'abort')).toHaveLength(0)
    expect(emitDestroySpy).toHaveBeenCalledTimes(1)
    expect(pool.workerNodes[0].usage.tasks.executed).toBe(1)
    expect(pool.workerNodes[0].usage.tasks.failed).toBe(0)
  })

  it.each([
    [PoolEvents.busyEnd, 1],
    [PoolEvents.backPressureEnd, 2],
  ])(
    'continues queued dispatch before surfacing a %s listener failure',
    { retry: 0, timeout: 10_000 },
    async (eventName, queuedTaskCount) => {
      const pool = trackPool(
        new FixedThreadPool(1, workerPath, {
          enableTasksQueue: true,
          tasksQueueOptions: {
            concurrency: 1,
            size: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
        })
      )
      if (!pool.info.ready) {
        await new Promise(resolve =>
          pool.emitter.once(PoolEvents.ready, resolve)
        )
      }
      await pool.addTaskFunction('waitForRelease', data => {
        const view = new Int32Array(data)
        Atomics.store(view, 1, 1)
        Atomics.notify(view, 1)
        Atomics.wait(view, 0, 0)
        return Atomics.load(view, 0)
      })
      await pool.addTaskFunction('recordExecution', data => {
        Atomics.add(new Int32Array(data), 0, 1)
      })
      const release = new Int32Array(
        new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2)
      )
      const executions = new Int32Array(
        new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)
      )
      const emitDestroySpy = vi.spyOn(AsyncResource.prototype, 'emitDestroy')
      const abortControllers = Array.from(
        { length: queuedTaskCount },
        () => new AbortController()
      )
      const listenerError = new Error(`${eventName} listener`)
      const { queuedRethrow, queuedRethrows } = captureQueuedRethrows()
      const blockingTaskStarted = Atomics.waitAsync(release, 1, 0).value
      const blockingTask = pool.execute(release.buffer, 'waitForRelease')
      await blockingTaskStarted
      let queuedTaskCountObserved = 0
      let resolveTasksQueued
      const tasksQueued = new Promise(resolve => {
        resolveTasksQueued = resolve
      })
      const enqueueTask = pool.workerNodes[0].enqueueTask.bind(
        pool.workerNodes[0]
      )
      vi.spyOn(pool.workerNodes[0], 'enqueueTask').mockImplementation(task => {
        const queueSize = enqueueTask(task)
        if (++queuedTaskCountObserved === queuedTaskCount) resolveTasksQueued()
        return queueSize
      })
      const queuedTasks = abortControllers.map(abortController =>
        pool.execute(
          executions.buffer,
          'recordExecution',
          abortController.signal
        )
      )
      await tasksQueued
      pool.emitter.on(eventName, () => {
        throw listenerError
      })

      Atomics.store(release, 0, 1)
      Atomics.notify(release, 0)
      await Promise.all([blockingTask, ...queuedTasks])
      expect(Atomics.load(executions, 0)).toBe(queuedTaskCount)
      await queuedRethrow
      expect(pool.info.executingTasks).toBe(0)
      expect(pool.info.queuedTasks).toBe(0)
      expect(queuedRethrows).toStrictEqual([listenerError])
      for (const abortController of abortControllers) {
        expect(getEventListeners(abortController.signal, 'abort')).toHaveLength(
          0
        )
      }
      expect(emitDestroySpy).toHaveBeenCalledTimes(queuedTaskCount + 1)
    }
  )
})
