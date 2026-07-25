import { describe, expect, it } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
} from '../../lib/index.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'

describe('Crash recovery regression test suite', () => {
  const { trackPool } = createCrashRecoveryTestContext()

  it('single-worker crash emits one taskFinished per rejected in-flight task', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const N = 4
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        enableTasksQueue: true,
        errorHandler: () => undefined,
        restartWorkerOnError: false,
        tasksQueueOptions: { concurrency: N },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    let taskFinishedCount = 0
    for (const workerNode of pool.workerNodes) {
      workerNode.on('taskFinished', () => {
        ++taskFinishedCount
      })
    }
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
    expect(pool.info.executingTasks).toBe(N)
    expect(pool.info.queuedTasks).toBe(0)
    await Promise.allSettled(promises)
    expect(rejections.length).toBe(N)
    expect(rejections.every(e => e instanceof WorkerCrashError)).toBe(true)
    expect(taskFinishedCount).toBe(N)
  })

  it('crash-to-settlement latency stays well under the termination grace window', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const N = 4
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        enableTasksQueue: true,
        errorHandler: () => undefined,
        restartWorkerOnError: false,
        tasksQueueOptions: { concurrency: N },
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
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
    expect(pool.info.executingTasks).toBe(N)
    expect(pool.info.queuedTasks).toBe(0)
    const start = performance.now()
    await Promise.allSettled(promises)
    const elapsed = performance.now() - start
    expect(rejections.length).toBe(N)
    expect(rejections.every(e => e instanceof WorkerCrashError)).toBe(true)
    expect(elapsed).toBeLessThan(1000)
  })
})
