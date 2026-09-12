import { describe, expect, it } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  PoolUnrecoverableError,
  WorkerCrashError,
} from '../../lib/index.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'

describe('Worker restart policy regression test suite', () => {
  const { trackPool } = createCrashRecoveryTestContext()

  it('trips the restart circuit breaker on a crash loop then fast-fails with PoolUnrecoverableError', {
    retry: 0,
    timeout: 30_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, './tests/worker-files/thread/crashWorker.mjs', {
        errorHandler: () => undefined,
        restartPolicy: { maxRestarts: 1, windowTime: 60_000 },
        restartWorkerOnError: true,
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }

    const unrecoverableObserved = Promise.withResolvers()
    const degradedEvents = []
    pool.emitter.on(PoolEvents.degraded, event => {
      degradedEvents.push(event)
      if (event.unrecoverable) unrecoverableObserved.resolve(event)
    })

    const rejections = []
    let fastFailError
    for (let attempt = 0; attempt < 10 && fastFailError == null; attempt++) {
      try {
        await pool.execute()
      } catch (error) {
        rejections.push(error)
        if (error instanceof PoolUnrecoverableError) fastFailError = error
      }
    }

    const tripEvent = await unrecoverableObserved.promise

    // The breaker trip is signaled as an unrecoverable degraded event.
    expect(tripEvent.reason).toBe('circuitBreakerTripped')
    expect(tripEvent.unrecoverable).toBe(true)
    // The crash loop rejects with WorkerCrashError until the breaker trips.
    expect(rejections.some(error => error instanceof WorkerCrashError)).toBe(
      true
    )
    // Once unrecoverable, submissions fail fast instead of queuing forever.
    expect(fastFailError).toBeInstanceOf(PoolUnrecoverableError)
    await expect(pool.execute()).rejects.toThrow(PoolUnrecoverableError)
  })
})
