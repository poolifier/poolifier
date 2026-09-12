import { describe, expect, it } from 'vitest'

import {
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
} from '../../lib/index.mjs'
import { createCrashRecoveryTestContext } from './crash-recovery-test-support.mjs'
import { collectRejection } from './crash-recovery-utils.mjs'

describe('Pool degraded health regression test suite', () => {
  const { trackPool } = createCrashRecoveryTestContext()

  it('signals degraded belowMinimum on worker crash then degradedEnd on recovery', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(
        2,
        './tests/worker-files/thread/processExitWorker.mjs',
        {
          errorHandler: () => undefined,
        }
      )
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }

    const degradedEvents = []
    pool.emitter.on(PoolEvents.degraded, event => {
      degradedEvents.push(event)
    })
    const recovered = new Promise(resolve => {
      pool.emitter.once(PoolEvents.degradedEnd, resolve)
    })

    const rejections = []
    await Promise.allSettled(
      [...pool.workerNodes].map(() =>
        collectRejection(pool.execute(), rejections)
      )
    )
    expect(rejections).toHaveLength(2)
    expect(rejections.every(error => error instanceof WorkerCrashError)).toBe(
      true
    )

    const recoveryInfo = await recovered

    const belowMinimum = degradedEvents.find(
      event => event.reason === 'belowMinimum'
    )
    expect(belowMinimum).toBeDefined()
    expect(belowMinimum.unrecoverable).toBe(false)
    expect(belowMinimum.minSize).toBe(2)
    expect(belowMinimum.readyWorkerNodeCount).toBeLessThan(2)
    expect(
      degradedEvents.some(event => event.reason === 'circuitBreakerTripped')
    ).toBe(false)
    expect(recoveryInfo).toMatchObject({ started: true })
    expect(pool.workerNodes.every(workerNode => workerNode.info.ready)).toBe(
      true
    )
  })
})
