import { afterEach, expect, it } from 'vitest'

import { PoolEvents, WorkerCrashError } from '../../lib/index.mjs'
import {
  destroyAll,
  eventOnce,
  expectIdle,
  settle,
  transports,
  waitForReady,
} from './pool-contract-helpers.mjs'

const pools = []
afterEach(() => destroyAll(pools))

for (const transport of transports) {
  const green = `[green][${transport.name}]`

  it(`${green} deduplicates worker error and exit into one settlement error and replacement`, {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const onlineWorkers = []
    let replacementOnlineResolve
    const replacementOnline = new Promise(resolve => {
      replacementOnlineResolve = resolve
    })
    const pool = new transport.FixedPool(1, transport.workers.crash, {
      errorHandler: () => undefined,
      onlineHandler: () => {
        onlineWorkers.push('online')
        if (onlineWorkers.length === 2) replacementOnlineResolve()
      },
    })
    pools.push(pool)
    await waitForReady(pool)
    const poolError = eventOnce(pool, PoolEvents.error)
    let settlements = 0

    const outcome = await settle(pool.execute()).then(result => {
      ++settlements
      return result
    })
    const [emittedError] = await Promise.all([poolError, replacementOnline])

    expect(outcome.status).toBe('rejected')
    expect(outcome.reason).toBeInstanceOf(WorkerCrashError)
    expect(settlements).toBe(1)
    expect(emittedError).toBeInstanceOf(WorkerCrashError)
    expect(onlineWorkers).toHaveLength(2)
    expectIdle(expect, pool)
  })

  it(`${green} ignores a late exit after settlement and keeps the replacement usable`, {
    retry: 0,
    timeout: 20_000,
  }, async () => {
    const taskErrors = []
    const pool = new transport.FixedPool(1, transport.workers.resolveThenExit, {
      errorHandler: () => undefined,
    })
    pools.push(pool)
    await waitForReady(pool)
    pool.emitter.on(PoolEvents.taskError, error => taskErrors.push(error))
    const replacementReady = eventOnce(pool, PoolEvents.ready)

    const firstValue = await pool.execute()
    await replacementReady
    const replacementValue = await pool.execute()

    expect(firstValue).toEqual(transport.resolveThenExitValue)
    expect(replacementValue).toEqual(transport.resolveThenExitValue)
    expect(taskErrors).toHaveLength(0)
    expect(pool.info.executedTasks).toBe(2)
    expectIdle(expect, pool)
  })

  it(`${green} treats clean exit with owned work as a crash and applies restart policy`, {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const onlineWorkers = []
    let replacementOnlineResolve
    const replacementOnline = new Promise(resolve => {
      replacementOnlineResolve = resolve
    })
    const pool = new transport.FixedPool(1, transport.workers.cleanExit, {
      errorHandler: () => undefined,
      onlineHandler: () => {
        onlineWorkers.push('online')
        if (onlineWorkers.length === 2) replacementOnlineResolve()
      },
    })
    pools.push(pool)
    await waitForReady(pool)
    const poolError = eventOnce(pool, PoolEvents.error)

    const outcome = await settle(pool.execute())
    const [emittedError] = await Promise.all([poolError, replacementOnline])

    expect(outcome.status).toBe('rejected')
    expect(outcome.reason).toBeInstanceOf(WorkerCrashError)
    expect(emittedError).toBeInstanceOf(WorkerCrashError)
    expect(onlineWorkers).toHaveLength(2)
    expectIdle(expect, pool)
  })
}

for (const transport of transports) {
  it(`[green][${transport.name}] rolls back every worker after partial startup failure`, {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const pool = new transport.FixedPool(2, transport.workers.preReadyCrash, {
      errorHandler: () => undefined,
      restartWorkerOnError: false,
    })
    pools.push(pool)

    await eventOnce(pool, PoolEvents.error)

    expect(pool.info.started).toBe(false)
    expect(pool.info.workerNodes).toBe(0)
  })
}
