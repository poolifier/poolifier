import { afterEach, expect, it, vi } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../../lib/index.mjs'

const pools = []

afterEach(async () => {
  vi.restoreAllMocks()
  while (pools.length > 0) {
    const pool = pools.pop()
    if (pool.info.started) await pool.destroy()
  }
})

it('[internal-model][green] redistributes one isolated worker queue exactly once', {
  retry: 0,
  timeout: 15_000,
}, async () => {
  const pool = new FixedThreadPool(
    2,
    './tests/worker-files/thread/asyncWorker.mjs',
    {
      enableTasksQueue: true,
      errorHandler: () => undefined,
      tasksQueueOptions: { concurrency: 1, tasksFinishedTimeout: 1000 },
    }
  )
  pools.push(pool)
  if (!pool.info.ready) {
    await new Promise(resolve => pool.emitter.once(PoolEvents.ready, resolve))
  }
  const terminating = pool.execute({ terminating: true }).catch(() => undefined)
  const peer = pool.execute({ peer: true })
  const queuedValues = Promise.all([
    pool.execute({ sequence: 1 }),
    pool.execute({ sequence: 2 }),
    pool.execute({ sequence: 3 }),
  ])
  expect(pool.info).toMatchObject({ executingTasks: 2, queuedTasks: 3 })

  // Public APIs cannot select one worker for removal, so this model invokes
  // only that lifecycle boundary and observes normal task/accounting outputs.
  await pool.destroyWorkerNode(0)
  const values = await queuedValues
  await Promise.all([terminating, peer])

  expect(values).toEqual([{ sequence: 1 }, { sequence: 2 }, { sequence: 3 }])
  expect(pool.info).toMatchObject({
    executedTasks: 4,
    executingTasks: 0,
    failedTasks: 1,
    queuedTasks: 0,
  })
})
