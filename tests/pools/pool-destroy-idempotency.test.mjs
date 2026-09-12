import { afterEach, describe, expect, it } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../lib/index.mjs'
import {
  createPoolCleanup,
  echoThreadWorkerPath,
} from './crash-recovery-utils.mjs'

describe('Pool destroy idempotency', () => {
  const { cleanupPools, trackPool } = createPoolCleanup()
  afterEach(cleanupPools)

  it('concurrent pool.destroy() calls are silently idempotent', {
    retry: 0,
    timeout: 10_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(2, echoThreadWorkerPath, {
        errorHandler: () => undefined,
      })
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
    const results = await Promise.allSettled([pool.destroy(), pool.destroy()])
    expect(results.every(result => result.status === 'fulfilled')).toBe(true)
    expect(pool.workerNodes.length).toBe(0)
    expect(errorEvents.length).toBe(0)
  })
})
