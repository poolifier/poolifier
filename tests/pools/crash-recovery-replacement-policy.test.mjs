import { describe, expect, it } from 'vitest'

import {
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
} from '../../lib/index.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'
import { collectRejection } from './crash-recovery-utils.mjs'

describe('Crash recovery regression test suite', () => {
  const { trackPool } = createCrashRecoveryTestContext()

  it('crashed worker failed usage is updated and replacement remains selectable', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        2,
        './tests/worker-files/thread/processExitWorker.mjs',
        { errorHandler: () => undefined }
      )
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const originalWorkerNodes = [...pool.workerNodes]
    const replacementReady = new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
    const rejections = []
    const promises = originalWorkerNodes.map(() =>
      collectRejection(pool.execute(), rejections)
    )
    await Promise.allSettled(promises)
    expect(rejections.length).toBe(originalWorkerNodes.length)
    expect(rejections.every(error => error instanceof WorkerCrashError)).toBe(
      true
    )
    expect(
      originalWorkerNodes.map(workerNode => workerNode.usage.tasks.failed)
    ).toEqual(originalWorkerNodes.map(() => 1))
    await replacementReady
    expect(pool.workerNodes.every(workerNode => workerNode.info.ready)).toBe(
      true
    )
  })

  it('clean exit(0) mid-task with restartWorkerOnError:false does NOT replenish', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/cleanExitInFlightWorker.mjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
          restartWorkerOnError: false,
        }
      )
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const terminated = new Promise(resolve => {
      pool.workerNodes[0].once('terminated', resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    await terminated
    expect(pool.workerNodes.length).toBe(0)
  })
  it('clean process.exit(0) replenishes even with restartWorkerOnError:false', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/cleanExitWorker.mjs',
        { restartWorkerOnError: false }
      )
    )
    const originalWorkerId = pool.workerNodes[0].info.id
    const replacementReady = new Promise(resolve => {
      pool.emitter.on(PoolEvents.ready, () => {
        if (pool.workerNodes[0]?.info.id !== originalWorkerId) {
          resolve()
        }
      })
    })
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    await replacementReady
    expect(pool.workerNodes[0].info.id).not.toBe(originalWorkerId)
  })

  it('clean exit with queued-only work replenishes without reporting a crash', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/cleanExitWorker.mjs',
        {
          enableTasksQueue: true,
          errorHandler: () => undefined,
          restartWorkerOnError: false,
          tasksQueueOptions: { concurrency: 1 },
        }
      )
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const originalWorkerNode = pool.workerNodes[0]
    const errors = []
    pool.emitter.on(PoolEvents.error, error => {
      errors.push(error)
    })
    originalWorkerNode.usage.tasks.executing = 1
    const queued = pool.execute({ queued: true })
    originalWorkerNode.usage.tasks.executing = 0
    expect(pool.info).toMatchObject({ executingTasks: 0, queuedTasks: 1 })

    await expect(queued).resolves.toBeUndefined()

    expect(errors).toStrictEqual([])
    expect(pool.workerNodes[0].info.id).not.toBe(originalWorkerNode.info.id)
    expect(pool.info).toMatchObject({ executingTasks: 0, queuedTasks: 0 })
  })

  it('crash with restartWorkerOnError:false does NOT replenish', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    // Replenishment predicate: `code === 0` is false AND
    // `restartWorkerOnError === true` is false → no replenishment.
    const pool = trackPool(
      new FixedThreadPool(
        1,
        './tests/worker-files/thread/processExitWorker.mjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
          restartWorkerOnError: false,
        }
      )
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const terminated = new Promise(resolve => {
      pool.workerNodes[0].once('terminated', resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    await terminated
    expect(pool.workerNodes.length).toBe(0)
  })
  it('cluster crash with restartWorkerOnError:false does NOT replenish', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedClusterPool(
        1,
        './tests/worker-files/cluster/processExitWorker.cjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
          restartWorkerOnError: false,
        }
      )
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const terminated = new Promise(resolve => {
      pool.workerNodes[0].once('terminated', resolve)
    })
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    await terminated
    expect(pool.workerNodes.length).toBe(0)
  })
})
