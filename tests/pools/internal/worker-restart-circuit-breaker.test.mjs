import { expect, it } from 'vitest'

import { WorkerRestartCircuitBreaker } from '../../../lib/pools/worker-restart-circuit-breaker.mjs'

it('permits restarts up to the threshold within the window', () => {
  const breaker = new WorkerRestartCircuitBreaker(3, 1000)
  expect(breaker.attemptRestart(0)).toBe(true)
  expect(breaker.attemptRestart(100)).toBe(true)
  expect(breaker.attemptRestart(200)).toBe(true)
  expect(breaker.tripped).toBe(false)
})

it('trips when restarts exceed the threshold within the window', () => {
  const breaker = new WorkerRestartCircuitBreaker(3, 1000)
  expect(breaker.attemptRestart(0)).toBe(true)
  expect(breaker.attemptRestart(100)).toBe(true)
  expect(breaker.attemptRestart(200)).toBe(true)
  expect(breaker.attemptRestart(300)).toBe(false)
  expect(breaker.tripped).toBe(true)
})

it('never trips when restarts are spaced beyond the window', () => {
  const breaker = new WorkerRestartCircuitBreaker(2, 1000)
  expect(breaker.attemptRestart(0)).toBe(true)
  expect(breaker.attemptRestart(1500)).toBe(true)
  expect(breaker.attemptRestart(3000)).toBe(true)
  expect(breaker.attemptRestart(4500)).toBe(true)
  expect(breaker.tripped).toBe(false)
})

it('counts a restart exactly at the window boundary as still inside the window', () => {
  const breaker = new WorkerRestartCircuitBreaker(2, 1000)
  expect(breaker.attemptRestart(0)).toBe(true)
  expect(breaker.attemptRestart(1000)).toBe(true)
  expect(breaker.attemptRestart(1000)).toBe(false)
  expect(breaker.tripped).toBe(true)
})

it('latches once tripped', () => {
  const breaker = new WorkerRestartCircuitBreaker(1, 1000)
  expect(breaker.attemptRestart(0)).toBe(true)
  expect(breaker.attemptRestart(100)).toBe(false)
  expect(breaker.attemptRestart(5000)).toBe(false)
  expect(breaker.tripped).toBe(true)
})

it('is disabled when maxRestarts is infinite', () => {
  const breaker = new WorkerRestartCircuitBreaker()
  for (let index = 0; index < 1000; index++) {
    expect(breaker.attemptRestart(index)).toBe(true)
  }
  expect(breaker.tripped).toBe(false)
})

it('clears the latch and window on reset so it can trip again', () => {
  const breaker = new WorkerRestartCircuitBreaker(1, 1000)
  expect(breaker.attemptRestart(0)).toBe(true)
  expect(breaker.attemptRestart(100)).toBe(false)
  expect(breaker.tripped).toBe(true)
  breaker.reset()
  expect(breaker.tripped).toBe(false)
  expect(breaker.attemptRestart(200)).toBe(true)
  expect(breaker.attemptRestart(300)).toBe(false)
  expect(breaker.tripped).toBe(true)
})
