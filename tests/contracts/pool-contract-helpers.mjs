import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
} from '../../lib/index.mjs'

export const transports = [
  {
    DynamicPool: DynamicThreadPool,
    FixedPool: FixedThreadPool,
    name: 'thread',
    resolveThenExitValue: { ok: true },
    workers: {
      async: './tests/worker-files/thread/asyncWorker.mjs',
      cleanExit: './tests/worker-files/thread/cleanExitInFlightWorker.mjs',
      crash: './tests/worker-files/thread/crashWorker.mjs',
      echo: './tests/worker-files/thread/echoWorker.mjs',
      preReadyCrash: './tests/worker-files/thread/preReadyCrashWorker.mjs',
      resolveThenExit: './tests/worker-files/thread/resolveThenExitWorker.mjs',
    },
  },
  {
    DynamicPool: DynamicClusterPool,
    FixedPool: FixedClusterPool,
    name: 'cluster',
    resolveThenExitValue: undefined,
    workers: {
      async: './tests/worker-files/cluster/asyncWorker.cjs',
      cleanExit: './tests/worker-files/cluster/cleanExitInFlightWorker.cjs',
      crash: './tests/worker-files/cluster/crashWorker.cjs',
      echo: './tests/worker-files/cluster/echoWorker.cjs',
      preReadyCrash: './tests/worker-files/cluster/preReadyCrashWorker.cjs',
      resolveThenExit: './tests/worker-files/cluster/cleanExitWorker.cjs',
    },
  },
]

export const waitForReady = async pool => {
  if (pool.info.ready) return
  await new Promise(resolve => {
    pool.emitter.once(PoolEvents.ready, resolve)
    if (pool.info.ready) resolve()
  })
}

export const eventOnce = (pool, event) =>
  new Promise(resolve => pool.emitter.once(event, resolve))

export const settle = promise =>
  promise.then(
    value => ({ status: 'fulfilled', value }),
    reason => ({ reason, status: 'rejected' })
  )

export const destroyAll = async pools => {
  const livePools = pools.splice(0)
  await Promise.all(
    livePools.map(async pool => {
      if (pool.info.started) await pool.destroy()
    })
  )
}

export const expectIdle = (expect, pool) => {
  expect(pool.info.queuedTasks ?? 0).toBe(0)
  expect(pool.info.executingTasks ?? 0).toBe(0)
}
