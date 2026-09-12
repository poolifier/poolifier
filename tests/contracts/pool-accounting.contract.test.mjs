import { afterEach, expect, it } from 'vitest'

import { PoolEvents } from '../../lib/index.mjs'
import {
  destroyAll,
  expectIdle,
  transports,
  waitForReady,
} from './pool-contract-helpers.mjs'

const pools = []
afterEach(() => destroyAll(pools))

for (const transport of transports) {
  const green = `[green][${transport.name}]`

  it(`${green} destroys during actual crash reconciliation without residual accounting`, {
    retry: 0,
    timeout: 20_000,
  }, async () => {
    let resolveDestroyed
    const destroyed = new Promise(resolve => {
      resolveDestroyed = resolve
    })
    const pool = new transport.FixedPool(1, transport.workers.crash, {
      enableTasksQueue: true,
      errorHandler: () => undefined,
      tasksQueueOptions: { concurrency: 1 },
    })
    pools.push(pool)
    await waitForReady(pool)

    pool.emitter.once(PoolEvents.error, () =>
      pool.destroy().then(resolveDestroyed)
    )
    const outcomes = await Promise.allSettled([pool.execute(), pool.execute()])
    await destroyed

    expect(outcomes.every(outcome => outcome.status === 'rejected')).toBe(true)
    expect(pool.info.started).toBe(false)
    expect(pool.info.workerNodes).toBe(0)
    expectIdle(expect, pool)
  })
}
