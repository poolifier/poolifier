import { expect, it, vi } from 'vitest'

import {
  collectLifecycleFailures,
  PoolLifecycle,
} from '../../../lib/pools/pool-lifecycle.mjs'

it('applies the stopped starting running command table', async () => {
  const lifecycle = new PoolLifecycle()

  expect(lifecycle.running).toBe(false)
  expect(() => lifecycle.requireRunning('stopped')).toThrow('stopped')
  await expect(lifecycle.destroy(vi.fn())).rejects.toThrow(
    'Cannot destroy an already destroyed pool'
  )

  lifecycle.beginStart()
  expect(lifecycle.starting).toBe(true)
  expect(() => lifecycle.beginStart()).toThrow(
    'Cannot start an already starting pool'
  )
  await expect(lifecycle.destroy(vi.fn())).rejects.toThrow(
    'Cannot destroy a starting pool'
  )

  lifecycle.commitRunning()
  expect(lifecycle.running).toBe(true)
  expect(() => lifecycle.beginStart()).toThrow(
    'Cannot start an already started pool'
  )
})

it('commits closing synchronously and shares the destroy barrier', async () => {
  const lifecycle = new PoolLifecycle()
  const operation = Promise.withResolvers()
  lifecycle.beginStart()
  lifecycle.commitRunning()

  const first = lifecycle.destroy(() => operation.promise)
  const second = lifecycle.destroy(vi.fn())

  expect(lifecycle.destroying).toBe(true)
  expect(second).toBe(first)
  expect(() => lifecycle.beginStart()).toThrow('Cannot start a destroying pool')
  expect(() => lifecycle.requireRunning('closing')).toThrow('closing')
  operation.resolve()
  await first
  expect(lifecycle.destroying).toBe(false)
})

it('restores stopped after start rollback and destroy failure', async () => {
  const lifecycle = new PoolLifecycle()
  const failure = new Error('destroy failed')
  lifecycle.beginStart()
  lifecycle.rollbackStart()
  lifecycle.beginStart()
  lifecycle.commitRunning()

  await expect(lifecycle.destroy(() => Promise.reject(failure))).rejects.toBe(
    failure
  )
  lifecycle.beginStart()
  expect(lifecycle.starting).toBe(true)
})

it('drains lifecycle promises admitted while draining until stable', async () => {
  const lifecycle = new PoolLifecycle()
  const first = Promise.withResolvers()
  const second = Promise.withResolvers()
  lifecycle.track(first.promise)
  const drain = lifecycle.drain()

  lifecycle.track(second.promise)
  first.resolve('first')
  second.reject(new Error('second'))

  const outcomes = await drain
  expect(outcomes.map(outcome => outcome.status)).toEqual([
    'fulfilled',
    'rejected',
  ])
})

it('removes tracked promises immediately after fulfillment or rejection', async () => {
  const lifecycle = new PoolLifecycle()

  for (let index = 0; index < 100; index++) {
    const operation =
      index % 2 === 0
        ? Promise.resolve(index)
        : Promise.reject(new Error(`failure ${index}`))
    lifecycle.track(operation)
    await operation.catch(() => undefined)
  }

  expect(lifecycle.trackedPromiseCount).toBe(0)
})

it('keeps active failures visible to a stable destroy drain', async () => {
  const lifecycle = new PoolLifecycle()
  const active = Promise.withResolvers()
  lifecycle.track(active.promise)

  const drain = lifecycle.drain()
  active.reject(new Error('active failure'))

  await expect(drain).resolves.toEqual([
    expect.objectContaining({
      reason: expect.objectContaining({ message: 'active failure' }),
      status: 'rejected',
    }),
  ])
  expect(lifecycle.trackedPromiseCount).toBe(0)
})

it('reports active tracked failures through destroy', async () => {
  const lifecycle = new PoolLifecycle()
  const active = Promise.withResolvers()
  lifecycle.beginStart()
  lifecycle.commitRunning()
  lifecycle.track(active.promise)

  const destroy = lifecycle.destroy(async () => {
    const failures = collectLifecycleFailures(await lifecycle.drain())
    if (failures.length === 1) throw failures[0]
  })
  const failure = new Error('active destroy failure')
  active.reject(failure)

  await expect(destroy).rejects.toBe(failure)
  expect(lifecycle.trackedPromiseCount).toBe(0)
})

it('awaits failed-start cleanup before preserving stopped destroy rejection', async () => {
  const lifecycle = new PoolLifecycle()
  const cleanup = Promise.withResolvers()
  lifecycle.track(cleanup.promise)

  const first = lifecycle.destroy(() => Promise.resolve())
  const second = lifecycle.destroy(() => Promise.resolve())
  expect(second).toBe(first)
  cleanup.resolve()

  await expect(first).rejects.toThrow(
    'Cannot destroy an already destroyed pool'
  )
})
