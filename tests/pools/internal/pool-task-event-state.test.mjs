import { describe, expect, it, vi } from 'vitest'

import { PoolEventPublisher } from '../../../lib/pools/pool-event-publisher.mjs'
import { PoolTaskEventState } from '../../../lib/pools/pool-task-event-state.mjs'

describe('PoolTaskEventState', () => {
  it('publishes each edge once and commits state before listener delivery', () => {
    const publisher = new PoolEventPublisher('event-state-test', true)
    const ready = true
    let busy = true
    let backPressure = true
    const info = { ready: true }
    const state = new PoolTaskEventState({
      backPressure: () => backPressure,
      busy: () => busy,
      info: () => info,
      publisher,
      ready: () => ready,
    })
    const observed = []
    publisher.emitter.on('ready', () =>
      observed.push(['ready', state.readyEventEmitted])
    )
    publisher.emitter.on('busy', () =>
      observed.push(['busy', state.busyEventEmitted])
    )
    publisher.emitter.on('backPressure', () =>
      observed.push(['backPressure', state.backPressureEventEmitted])
    )

    state.checkReady()
    state.checkReady()
    state.checkExecutionStarted()
    state.checkExecutionStarted()
    state.checkTaskQueued()
    state.checkTaskQueued()

    expect(observed).toEqual([
      ['ready', true],
      ['busy', true],
      ['backPressure', true],
    ])
    busy = false
    backPressure = false
    state.checkExecutionFinished('lease')
    state.checkTaskDequeued('lease')
    expect(state.busyEventEmitted).toBe(false)
    expect(state.backPressureEventEmitted).toBe(false)
  })

  it('does not evaluate or mutate edges without an emitter', () => {
    const publisher = new PoolEventPublisher('event-state-test', false)
    const busy = vi.fn(() => true)
    const state = new PoolTaskEventState({
      backPressure: () => true,
      busy,
      info: () => ({}),
      publisher,
      ready: () => true,
    })

    state.checkExecutionStarted()

    expect(busy).not.toHaveBeenCalled()
    expect(state.busyEventEmitted).toBe(false)
  })
})
