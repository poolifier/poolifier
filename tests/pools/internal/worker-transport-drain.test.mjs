import { describe, expect, it, vi } from 'vitest'

import { waitForWorkerTransportDrain } from '../../../lib/pools/worker-transport-drain.mjs'

describe('Worker transport drain', () => {
  it('allows a legacy worker node without a transport drain barrier', async () => {
    const worker = { info: { dynamic: false } }

    await expect(waitForWorkerTransportDrain(worker)).resolves.toBeUndefined()
  })

  it('waits for an internal worker transport drain barrier', async () => {
    const drain = Promise.withResolvers()
    const waitForTransportDrain = vi.fn(() => drain.promise)
    const worker = { info: { dynamic: false }, waitForTransportDrain }

    const pendingDrain = waitForWorkerTransportDrain(worker)
    expect(waitForTransportDrain).toHaveBeenCalledOnce()
    let settled = false
    const settlement = pendingDrain.then(() => {
      settled = true
      return undefined
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    drain.resolve()
    await expect(settlement).resolves.toBeUndefined()
  })
})
