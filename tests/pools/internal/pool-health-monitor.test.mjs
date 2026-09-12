import { expect, it } from 'vitest'

import { PoolHealthMonitor } from '../../../lib/pools/pool-health-monitor.mjs'

const createMonitor = (overrides = {}) => {
  const state = {
    degradedEndEvents: 0,
    degradedEvents: [],
    minSize: 2,
    readyWorkerNodeCount: 2,
    started: true,
    tripped: false,
    ...overrides,
  }
  const monitor = new PoolHealthMonitor({
    minSize: () => state.minSize,
    publishDegraded: event => {
      state.degradedEvents.push(event)
    },
    publishDegradedEnd: () => {
      state.degradedEndEvents++
    },
    readyWorkerNodeCount: () => state.readyWorkerNodeCount,
    started: () => state.started,
    tripped: () => state.tripped,
  })
  return { monitor, state }
}

it('does not emit degraded during the startup ramp before reaching minimum', () => {
  const { monitor, state } = createMonitor({ readyWorkerNodeCount: 0 })
  monitor.refresh()
  state.readyWorkerNodeCount = 1
  monitor.refresh()
  state.readyWorkerNodeCount = 2
  monitor.refresh()
  expect(monitor.state).toBe('healthy')
  expect(state.degradedEvents).toHaveLength(0)
  expect(state.degradedEndEvents).toBe(0)
})

it('transitions to degraded only after reaching minimum then dropping below it', () => {
  const { monitor, state } = createMonitor()
  monitor.refresh()
  expect(monitor.state).toBe('healthy')
  state.readyWorkerNodeCount = 1
  monitor.refresh()
  expect(monitor.state).toBe('degraded')
  expect(monitor.unrecoverable).toBe(false)
  expect(state.degradedEvents).toStrictEqual([
    {
      minSize: 2,
      readyWorkerNodeCount: 1,
      reason: 'belowMinimum',
      unrecoverable: false,
    },
  ])
})

it('transitions from degraded back to healthy and emits degradedEnd', () => {
  const { monitor, state } = createMonitor()
  monitor.refresh()
  state.readyWorkerNodeCount = 1
  monitor.refresh()
  expect(monitor.state).toBe('degraded')
  state.readyWorkerNodeCount = 2
  monitor.refresh()
  expect(monitor.state).toBe('healthy')
  expect(state.degradedEndEvents).toBe(1)
})

it('transitions to unrecoverable when the circuit breaker tripped and latches', () => {
  const { monitor, state } = createMonitor()
  state.tripped = true
  monitor.refresh()
  expect(monitor.state).toBe('unrecoverable')
  expect(monitor.unrecoverable).toBe(true)
  expect(state.degradedEvents).toStrictEqual([
    {
      minSize: 2,
      readyWorkerNodeCount: 2,
      reason: 'circuitBreakerTripped',
      unrecoverable: true,
    },
  ])
  state.tripped = false
  state.readyWorkerNodeCount = 2
  monitor.refresh()
  expect(monitor.state).toBe('unrecoverable')
  expect(monitor.unrecoverable).toBe(true)
  expect(state.degradedEvents).toHaveLength(1)
  expect(state.degradedEndEvents).toBe(0)
})

it('stays healthy when not started even with too few ready worker nodes', () => {
  const { monitor, state } = createMonitor()
  monitor.refresh()
  expect(monitor.state).toBe('healthy')
  state.started = false
  state.readyWorkerNodeCount = 0
  monitor.refresh()
  expect(monitor.state).toBe('healthy')
  expect(state.degradedEvents).toHaveLength(0)
  expect(state.degradedEndEvents).toBe(0)
})

it('does not emit again when refresh is called repeatedly in the same state', () => {
  const { monitor, state } = createMonitor()
  monitor.refresh()
  state.readyWorkerNodeCount = 1
  monitor.refresh()
  monitor.refresh()
  monitor.refresh()
  expect(monitor.state).toBe('degraded')
  expect(state.degradedEvents).toHaveLength(1)
  expect(state.degradedEndEvents).toBe(0)
})

it('re-arms startup-ramp masking after reset so a restart ramp is not degraded', () => {
  const { monitor, state } = createMonitor()
  monitor.refresh()
  expect(monitor.state).toBe('healthy')
  monitor.reset()
  state.readyWorkerNodeCount = 1
  monitor.refresh()
  expect(monitor.state).toBe('healthy')
  expect(state.degradedEvents).toHaveLength(0)
  expect(state.degradedEndEvents).toBe(0)
})

it('clears the unrecoverable latch on reset', () => {
  const { monitor, state } = createMonitor()
  state.tripped = true
  monitor.refresh()
  expect(monitor.state).toBe('unrecoverable')
  state.tripped = false
  monitor.reset()
  expect(monitor.state).toBe('healthy')
  expect(monitor.unrecoverable).toBe(false)
  monitor.refresh()
  expect(monitor.state).toBe('healthy')
})
