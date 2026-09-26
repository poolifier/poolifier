import { getEventListeners } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'

import { PoolEvents, WorkerTerminationError } from '../../lib/index.mjs'
import {
  destroyAll,
  eventOnce,
  expectIdle,
  settle,
  transports,
  waitForReady,
} from '../contracts/pool-contract-helpers.mjs'

const pools = []
afterEach(() => destroyAll(pools))

for (const transport of transports) {
  const green = `[green][${transport.name}]`

  it(`${green} rejects an already aborted submission by reason identity without execution`, {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const pool = new transport.FixedPool(1, transport.workers.async, {
      enableTasksQueue: true,
      tasksQueueOptions: { concurrency: 1 },
    })
    pools.push(pool)
    await waitForReady(pool)
    const blocker = pool.execute({ blocker: true })
    expect(pool.info.executingTasks).toBe(1)
    const controller = new AbortController()
    const reason = new Error('already aborted')
    controller.abort(reason)
    const outcome = await settle(
      pool.execute({ mustNotExecute: true }, undefined, controller.signal)
    )
    const blockerValue = await blocker
    expect(outcome).toMatchObject({ reason, status: 'rejected' })
    expect(outcome.reason).toBe(reason)
    expect(blockerValue).toEqual({ blocker: true })
    expect(pool.info.executedTasks).toBe(1)
    expect(pool.info.failedTasks).toBe(0)
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
    expectIdle(expect, pool)
  })

  it(`${green} removes a queued abort and progresses the next queued task`, {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const pool = new transport.FixedPool(1, transport.workers.async, {
      enableTasksQueue: true,
      tasksQueueOptions: { concurrency: 1 },
    })
    pools.push(pool)
    await waitForReady(pool)
    const blocker = pool.execute({ blocker: true })
    const controller = new AbortController()
    const reason = new Error('queued abort')
    const aborted = settle(
      pool.execute({ mustNotExecute: true }, undefined, controller.signal)
    )
    const later = pool.execute({ progressed: true })
    expect(pool.info.executingTasks).toBe(1)
    expect(pool.info.queuedTasks).toBe(2)
    controller.abort(reason)
    const abortedOutcome = await aborted
    const [blockerValue, laterValue] = await Promise.all([blocker, later])
    expect(abortedOutcome.reason).toBe(reason)
    expect(blockerValue).toEqual({ blocker: true })
    expect(laterValue).toEqual({ progressed: true })
    expect(pool.info.executedTasks).toBe(2)
    expect(pool.info.failedTasks).toBe(0)
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
    expectIdle(expect, pool)
  })

  it(`${green} keeps a running abort unavailable until cooperative cleanup then reuses it`, {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const pool = new transport.FixedPool(1, transport.workers.async, {
      enableTasksQueue: true,
      tasksQueueOptions: { concurrency: 1 },
    })
    pools.push(pool)
    await waitForReady(pool)
    const controller = new AbortController()
    const reason = new Error('running abort')
    const aborted = settle(
      pool.execute({ mustAbort: true }, undefined, controller.signal)
    )
    expect(pool.info.executingTasks).toBe(1)
    controller.abort(reason)
    expect(pool.info.executingTasks).toBe(1)
    const queued = pool.execute({ usable: true })
    expect(pool.info.queuedTasks).toBe(1)
    const abortedOutcome = await aborted
    const queuedValue = await queued
    expect(abortedOutcome.reason).toBe(reason)
    expect(queuedValue).toEqual({ usable: true })
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
    expectIdle(expect, pool)
  })

  it(`${green} full destroy rejects running and queued work with termination errors`, {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const pool = new transport.FixedPool(1, transport.workers.async, {
      enableTasksQueue: true,
      tasksQueueOptions: { concurrency: 1, tasksFinishedTimeout: 1000 },
    })
    pools.push(pool)
    await waitForReady(pool)
    const running = settle(pool.execute({ running: true }))
    const queued = settle(pool.execute({ queued: true }))
    expect(pool.info.executingTasks).toBe(1)
    expect(pool.info.queuedTasks).toBe(1)
    await pool.destroy()
    const outcomes = await Promise.all([running, queued])
    expect(outcomes.every(outcome => outcome.status === 'rejected')).toBe(true)
    expect(
      outcomes.every(
        outcome => outcome.reason instanceof WorkerTerminationError
      )
    ).toBe(true)
    expect(pool.info.workerNodes).toBe(0)
    expectIdle(expect, pool)
  })

  it(`${green} shares concurrent destroy teardown and outcome during crash replacement`, {
    retry: 0,
    timeout: 20_000,
  }, async () => {
    let destroyEvents = 0
    const pool = new transport.DynamicPool(1, 2, transport.workers.crash, {
      errorHandler: () => undefined,
    })
    pools.push(pool)
    await waitForReady(pool)
    pool.emitter.on(PoolEvents.destroy, () => ++destroyEvents)
    const crash = eventOnce(pool, PoolEvents.error)
    const task = settle(pool.execute())
    await crash
    const destroyOutcomes = await Promise.allSettled([
      pool.destroy(),
      pool.destroy(),
      pool.destroy(),
    ])
    const taskOutcome = await task
    expect(destroyOutcomes).toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ])
    expect(taskOutcome.status).toBe('rejected')
    expect(destroyEvents).toBe(1)
    expect(pool.info.started).toBe(false)
    expect(pool.info.workerNodes).toBe(0)
    expectIdle(expect, pool)
  })

  it(`${green} shares one reconciliation failure across concurrent destroy callers`, {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const pool = new transport.FixedPool(1, transport.workers.async)
    pools.push(pool)
    await waitForReady(pool)
    const terminationFailure = new Error('single destroy termination failure')
    vi.spyOn(pool.workerNodes[0], 'terminate').mockRejectedValue(
      terminationFailure
    )

    const outcomes = await Promise.allSettled([
      pool.destroy(),
      pool.destroy(),
      pool.destroy(),
    ])

    expect(outcomes.every(outcome => outcome.status === 'rejected')).toBe(true)
    const reasons = outcomes.map(outcome => outcome.reason)
    expect(reasons[0].name).toBe('WorkerReconciliationError')
    expect(reasons[0].cause).toBe(terminationFailure)
    expect(reasons[1]).toBe(reasons[0])
    expect(reasons[2]).toBe(reasons[0])
    expect(pool.info.started).toBe(false)
    expect(pool.info.workerNodes).toBe(0)
  })

  it(`${green} aggregates multiple reconciliation failures in worker order`, {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const pool = new transport.FixedPool(2, transport.workers.async)
    pools.push(pool)
    await waitForReady(pool)
    const terminationFailures = pool.workerNodes.map((workerNode, index) => {
      const failure = new Error(`destroy termination failure ${index}`)
      vi.spyOn(workerNode, 'terminate').mockRejectedValue(failure)
      return failure
    })

    const outcome = await Promise.allSettled([pool.destroy()])

    expect(outcome[0].status).toBe('rejected')
    expect(outcome[0].reason).toBeInstanceOf(AggregateError)
    expect(outcome[0].reason.errors).toHaveLength(2)
    expect(outcome[0].reason.errors.map(error => error.name)).toStrictEqual([
      'WorkerReconciliationError',
      'WorkerReconciliationError',
    ])
    expect(outcome[0].reason.errors.map(error => error.cause)).toStrictEqual(
      terminationFailures
    )
    expect(pool.info.started).toBe(false)
    expect(pool.info.workerNodes).toBe(0)
  })
}
