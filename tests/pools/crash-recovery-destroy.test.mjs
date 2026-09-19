import { describe, expect, it } from 'vitest'

import {
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
  WorkerTerminationError,
} from '../../lib/index.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'

describe('Crash recovery regression test suite', () => {
  const { expectWorkerCrashErrorForWorker, trackPool } =
    createCrashRecoveryTestContext()

  it('crash during destroy emits no undefined payload and surfaces a single typed rejection', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        enableTasksQueue: true,
        errorHandler: () => undefined,
        tasksQueueOptions: { tasksFinishedTimeout: 200 },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const workerId = pool.workerNodes[0].info.id
    const events = []
    pool.emitter.on(PoolEvents.error, e => {
      events.push(e)
    })
    const taskOutcomePromise = Promise.allSettled([pool.execute()])
    expect(pool.info.executingTasks).toBe(1)
    const destroyPromise = pool.destroy()
    expect(pool.destroy()).toBe(destroyPromise)
    const destroyOutcomePromise = Promise.allSettled([destroyPromise])
    const [taskOutcome] = await taskOutcomePromise
    const [destroyOutcome] = await destroyOutcomePromise
    expect(taskOutcome.status).toBe('rejected')
    expect(destroyOutcome.status).toBe('fulfilled')
    const rejected = taskOutcome.reason
    expectWorkerCrashErrorForWorker(rejected, workerId)
    expect(workerId).toBeDefined()
    expect(events).toHaveLength(1)
    expect(events[0]).not.toBeNull()
    expect(events[0]).toBeDefined()
    const poolError = events[0]
    expect(poolError).toBeInstanceOf(WorkerCrashError)
    expect(poolError).not.toBe(rejected)
    expect(poolError.taskId).toBeUndefined()
    expect(poolError.workerId).toBe(rejected.workerId)
    expect(poolError.exitCode).toBe(rejected.exitCode)
    expect(poolError.signal).toBe(rejected.signal)
    expect(poolError.cause).toBe(rejected.cause)
    expect(poolError.message).toBe(rejected.message)
  })
  it('spontaneous crash after drain rejects with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        enableTasksQueue: false,
        errorHandler: () => undefined,
        tasksQueueOptions: { tasksFinishedTimeout: 5_000 },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const workerId = pool.workerNodes[0].info.id
    const taskRejection = pool.execute().catch(e => e)
    expect(pool.info.executingTasks).toBe(1)
    const destroyPromise = pool.destroy()
    const rejected = await taskRejection
    await destroyPromise
    expectWorkerCrashErrorForWorker(rejected, workerId)
    expect(rejected).not.toBeInstanceOf(WorkerTerminationError)
  })
  it.each([
    [
      'thread',
      FixedThreadPool,
      './tests/worker-files/thread/processExitWorker.mjs',
    ],
    [
      'cluster',
      FixedClusterPool,
      './tests/worker-files/cluster/processExitWorker.cjs',
    ],
  ])(
    'destroy keeps distinct crash causes for active and queued %s work',
    {
      retry: 0,
      timeout: 10_000,
    },
    async (_workerType, Pool, workerPath) => {
      const pool = trackPool(
        new Pool(1, workerPath, {
          enableTasksQueue: true,
          errorHandler: () => undefined,
          tasksQueueOptions: { tasksFinishedTimeout: 5_000 },
        })
      )
      if (!pool.info.ready) {
        await new Promise(resolve => {
          pool.emitter.once(PoolEvents.ready, resolve)
        })
      }
      const errorEvents = []
      pool.emitter.on(PoolEvents.error, e => {
        errorEvents.push(e)
      })
      const workerId = pool.workerNodes[0].info.id
      const settlementOrder = []
      const activeOutcome = pool.execute().catch(e => {
        settlementOrder.push('active')
        return e
      })
      expect(pool.info.executingTasks).toBe(1)
      const queuedOutcome = pool.execute().catch(e => {
        settlementOrder.push('queued')
        return e
      })
      expect(pool.info.queuedTasks).toBe(1)
      const destroyPromise = pool.destroy()
      const [activeRejected, queuedRejected] = await Promise.all([
        activeOutcome,
        queuedOutcome,
      ])
      await destroyPromise
      expect(settlementOrder).toEqual(['active', 'queued'])
      expectWorkerCrashErrorForWorker(activeRejected, workerId)
      expectWorkerCrashErrorForWorker(queuedRejected, workerId)
      expect(activeRejected).not.toBe(queuedRejected)
      expect(activeRejected.taskId).not.toBe(queuedRejected.taskId)
      expect(errorEvents).toHaveLength(1)
      const poolError = errorEvents[0]
      expect(poolError).toBeInstanceOf(WorkerCrashError)
      expect(poolError).not.toBe(activeRejected)
      expect(poolError).not.toBe(queuedRejected)
      expect(poolError.taskId).toBeUndefined()
      expect(poolError.workerId).toBe(activeRejected.workerId)
      expect(poolError.workerId).toBe(queuedRejected.workerId)
      expect(poolError.exitCode).toBe(activeRejected.exitCode)
      expect(poolError.exitCode).toBe(queuedRejected.exitCode)
      expect(poolError.signal).toBe(activeRejected.signal)
      expect(poolError.signal).toBe(queuedRejected.signal)
      expect(poolError.cause).toBe(activeRejected.cause)
      expect(poolError.message).toBe(activeRejected.message)
    }
  )
  it('cluster clean process.exit(0) mid-task rejects with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedClusterPool(
        1,
        './tests/worker-files/cluster/cleanExitInFlightWorker.cjs',
        {
          enableTasksQueue: false,
          errorHandler: () => undefined,
        }
      )
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    let rejected
    try {
      await pool.execute()
    } catch (e) {
      rejected = e
    }
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.name).toBe('WorkerCrashError')
    expect(rejected.exitCode).toBe(0)
    expect(rejected.taskId).toBeDefined()
  })
})
