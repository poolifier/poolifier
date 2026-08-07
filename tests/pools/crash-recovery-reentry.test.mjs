import { describe, expect, it } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
} from '../../lib/index.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'

describe('Crash recovery regression test suite', () => {
  const { trackPool } = createCrashRecoveryTestContext()

  it('worker error then exit settles and emits once', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        errorHandler: () => undefined,
        restartWorkerOnError: false,
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const events = []
    pool.emitter.on(PoolEvents.error, e => {
      events.push(e)
    })
    const workerNode = pool.workerNodes[0]
    const workerId = workerNode.info.id
    const terminated = new Promise(resolve => {
      workerNode.once('terminated', resolve)
    })
    const errorObserved = new Promise(resolve => {
      pool.emitter.once(PoolEvents.error, resolve)
    })
    let settlementCount = 0
    const taskPromise = pool.execute()
    const settlementObserved = taskPromise.then(
      () => {
        return ++settlementCount
      },
      () => {
        return ++settlementCount
      }
    )
    const taskOutcome = Promise.allSettled([taskPromise])

    const [result] = await taskOutcome
    await settlementObserved
    const [error] = await Promise.all([errorObserved, terminated])
    expect(result.status).toBe('rejected')
    const rejected = result.reason
    expect(rejected).toBeInstanceOf(WorkerCrashError)
    expect(rejected.workerId).toBe(workerId)
    expect(settlementCount).toBe(1)
    expect(events.length).toBe(1)
    expect(error).toBe(events[0])
    expect(error).toBeInstanceOf(WorkerCrashError)
    expect(error.workerId).toBe(workerId)
    expect(pool.info).toMatchObject({
      executingTasks: 0,
      started: true,
    })
  })
})
