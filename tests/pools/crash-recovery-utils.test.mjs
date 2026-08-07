/* eslint-disable n/no-unsupported-features/node-builtins -- async_hooks is required to verify resource destruction. */
import { createHook } from 'node:async_hooks'
import { describe, expect, it, vi } from 'vitest'

import { createPoolCleanup } from './crash-recovery-utils.mjs'

describe('Crash recovery cleanup utilities', () => {
  it('continues cleanup after the first pool destroy failure', async () => {
    const destroyError = new Error('controlled destroy failure')
    const firstPool = {
      destroy: vi.fn(async () => {
        firstPool.info.started = false
        throw destroyError
      }),
      destroying: false,
      info: { started: true },
    }
    const secondPool = {
      destroy: vi.fn(async () => {
        secondPool.info.started = false
      }),
      destroying: false,
      info: { started: true },
    }
    const { cleanupPools, trackPool } = createPoolCleanup()
    trackPool(secondPool)
    trackPool(firstPool)

    await expect(cleanupPools()).rejects.toBe(destroyError)

    expect(firstPool.info.started).toBe(false)
    expect(secondPool.info.started).toBe(false)
    expect(firstPool.destroy).toHaveBeenCalledOnce()
    expect(secondPool.destroy).toHaveBeenCalledOnce()
    await cleanupPools()
    expect(firstPool.destroy).toHaveBeenCalledOnce()
    expect(secondPool.destroy).toHaveBeenCalledOnce()
  })

  it('preserves the first failure when multiple pool destroys fail', async () => {
    const firstError = new Error('first destroy failure')
    const secondError = new Error('second destroy failure')
    const firstPool = {
      destroy: vi.fn(async () => {
        firstPool.info.started = false
        throw firstError
      }),
      destroying: false,
      info: { started: true },
    }
    const secondPool = {
      destroy: vi.fn(async () => {
        secondPool.info.started = false
        throw secondError
      }),
      destroying: false,
      info: { started: true },
    }
    const { cleanupPools, trackPool } = createPoolCleanup()
    trackPool(secondPool)
    trackPool(firstPool)

    await expect(cleanupPools()).rejects.toBe(firstError)

    expect(firstPool.info.started).toBe(false)
    expect(secondPool.info.started).toBe(false)
    expect(firstPool.destroy).toHaveBeenCalledOnce()
    expect(secondPool.destroy).toHaveBeenCalledOnce()
  })

  it('awaits a pool destroy already in progress', async () => {
    const destroyOutcome = Promise.withResolvers()
    const pool = {
      destroying: true,
      info: { started: true },
    }
    const destroyPromise = destroyOutcome.promise.then(() => {
      pool.info.started = false
      pool.destroying = false
      return undefined
    })
    pool.destroy = vi.fn(() => destroyPromise)
    const { cleanupPools, trackPool } = createPoolCleanup()
    trackPool(pool)

    const cleanupPromise = cleanupPools()
    let cleanupSettled = false
    const cleanupSettlement = cleanupPromise.then(() => {
      cleanupSettled = true
      return undefined
    })
    await Promise.resolve()

    expect(pool.destroy).toHaveBeenCalledOnce()
    expect(cleanupSettled).toBe(false)
    expect(pool.info.started).toBe(true)
    destroyOutcome.resolve()
    await cleanupSettlement

    expect(pool.info.started).toBe(false)
  })

  it('restores the Timeout resource baseline after cleanup', async () => {
    const liveTimeouts = new Set()
    const hook = createHook({
      destroy: asyncId => {
        liveTimeouts.delete(asyncId)
      },
      init: (asyncId, type) => {
        if (type === 'Timeout') {
          liveTimeouts.add(asyncId)
        }
      },
    })
    hook.enable()
    try {
      const baselineTimeouts = liveTimeouts.size
      const { cleanupPools, trackPool } = createPoolCleanup()
      trackPool({
        destroy: () => Promise.resolve(),
        destroying: false,
        info: { started: true },
      })

      await cleanupPools()
      await new Promise(resolve => setImmediate(resolve))

      expect(liveTimeouts.size).toBe(baselineTimeouts)
    } finally {
      hook.disable()
    }
  })
})
