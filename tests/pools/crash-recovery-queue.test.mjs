import { describe, expect, it } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
} from '../../lib/index.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'

describe('Crash recovery regression test suite', () => {
  const { trackPool } = createCrashRecoveryTestContext()

  it('enableTasksQueue=false + worker crash rejects all in-flight with WorkerCrashError', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        2,
        './tests/worker-files/thread/processExitWorker.mjs',
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
    let poolErrorCount = 0
    const poolErrorsObserved = Promise.withResolvers()
    pool.emitter.on(PoolEvents.error, () => {
      if (++poolErrorCount === 2) poolErrorsObserved.resolve()
    })
    const N = 2
    const rejections = []
    const promises = []
    for (let i = 0; i < N; i++) {
      promises.push(
        pool.execute().catch(e => {
          rejections.push(e)
          return undefined
        })
      )
    }
    await Promise.allSettled(promises)
    await poolErrorsObserved.promise
    expect(rejections.length).toBe(N)
    expect(rejections.every(e => e?.name === 'WorkerCrashError')).toBe(true)
    expect(rejections.every(e => e instanceof WorkerCrashError)).toBe(true)
    expect(poolErrorCount).toBe(N)
  })

  it('simultaneous multi-worker crash rejects every in-flight task with WorkerCrashError', {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const N = 4
    const pool = trackPool(
      new FixedThreadPool(N, './tests/worker-files/thread/crashWorker.mjs', {
        errorHandler: () => undefined,
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const errorEvents = []
    const poolErrorsObserved = Promise.withResolvers()
    pool.emitter.on(PoolEvents.error, e => {
      errorEvents.push(e)
      if (errorEvents.length === N) poolErrorsObserved.resolve()
    })
    const rejections = []
    await Promise.allSettled(
      Array.from({ length: N }, () =>
        pool.execute().catch(e => {
          rejections.push(e)
          return undefined
        })
      )
    )
    await poolErrorsObserved.promise
    expect(rejections.length).toBe(N)
    expect(rejections.every(e => e instanceof WorkerCrashError)).toBe(true)
    expect(errorEvents.length).toBe(N)
    expect(errorEvents.every(e => e instanceof WorkerCrashError)).toBe(true)
  })

  it('keeps raw crash authority without a task when queued work cannot be redistributed', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        enableTasksQueue: true,
        errorHandler: () => undefined,
        restartWorkerOnError: false,
        tasksQueueOptions: { concurrency: 1 },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const workerId = pool.workerNodes[0].info.id
    const poolErrors = []
    const poolErrorObserved = new Promise(resolve => {
      pool.emitter.on(PoolEvents.error, error => {
        poolErrors.push(error)
        resolve(error)
      })
    })
    const activeReaction = pool.execute().catch(error => error)
    const queuedReaction = pool.execute().catch(error => error)
    await Promise.resolve()
    expect(pool.info).toMatchObject({ executingTasks: 1, queuedTasks: 1 })

    const [activeError, queuedError, poolError] = await Promise.all([
      activeReaction,
      queuedReaction,
      poolErrorObserved,
    ])

    expect(poolErrors).toHaveLength(1)
    expect(activeError).toBeInstanceOf(WorkerCrashError)
    expect(activeError.message).toBe(
      'Worker node crashed: Simulated worker crash'
    )
    expect(activeError.cause).toBe(poolError.cause)
    expect(activeError.cause).toBeInstanceOf(Error)
    expect(activeError.cause.message).toBe('Simulated worker crash')
    expect(activeError.taskId).toBeDefined()
    expect(activeError.workerId).toBe(workerId)
    expect(activeError.exitCode).toBeNull()
    expect(activeError.signal).toBeNull()

    expect(queuedError).toBeInstanceOf(WorkerCrashError)
    expect(queuedError).not.toBe(activeError)
    expect(queuedError.message).toBe('Worker node crashed')
    expect(Object.hasOwn(queuedError, 'cause')).toBe(false)
    expect(queuedError.message).not.toContain('Simulated worker crash')
    expect(queuedError.stack).not.toContain('Simulated worker crash')
    expect(queuedError.taskId).toBeDefined()
    expect(queuedError.taskId).not.toBe(activeError.taskId)
    expect(queuedError.workerId).toBe(workerId)
    expect(queuedError.exitCode).toBeNull()
    expect(queuedError.signal).toBeNull()

    expect(poolError).toBeInstanceOf(WorkerCrashError)
    expect(poolError).not.toBe(activeError)
    expect(poolError).not.toBe(queuedError)
    expect(poolError.message).toBe(
      'Worker node crashed: Simulated worker crash'
    )
    expect(poolError.taskId).toBeUndefined()
    expect(poolError.workerId).toBe(workerId)
    expect(poolError.exitCode).toBe(1)
    expect(poolError.signal).toBeNull()
  })
})
