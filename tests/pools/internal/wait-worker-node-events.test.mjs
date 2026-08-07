import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { waitWorkerNodeEvents } from '../../../lib/pools/utils.mjs'

describe('waitWorkerNodeEvents cancellation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('removes its listener and timer when aborted', async () => {
    vi.useFakeTimers()
    const workerNode = new EventEmitter()
    const controller = new AbortController()
    const reason = new Error('destroy overlap')
    const waiting = waitWorkerNodeEvents(
      workerNode,
      'taskExecutionFinished',
      1,
      40_000,
      false,
      controller.signal
    ).catch(error => error)

    expect(workerNode.listenerCount('taskExecutionFinished')).toBe(1)
    expect(vi.getTimerCount()).toBe(1)
    controller.abort(reason)

    await expect(waiting).resolves.toBe(reason)
    expect(workerNode.listenerCount('taskExecutionFinished')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
