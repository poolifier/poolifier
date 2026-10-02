import cluster from 'node:cluster'
import { beforeAll, describe, expect, it } from 'vitest'

import { FixedClusterPool, PoolEvents } from '../../../lib/index.mjs'
import { sleep, waitWorkerEvents } from '../../test-utils.cjs'

describe('Fixed cluster pool lifecycle test suite', () => {
  const numberOfWorkers = 8
  let pool

  beforeAll(async () => {
    pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    if (!pool.info.ready) {
      await new Promise(resolve => pool.emitter.once(PoolEvents.ready, resolve))
    }
  })

  it('Shutdown test', { retry: 0 }, async ({ skip }) => {
    if (process.env.CI != null) {
      skip()
      return
    }
    const exitPromise = waitWorkerEvents(pool, 'exit', numberOfWorkers)
    expect(pool.emitter.eventNames()).toStrictEqual([])
    let poolDestroy = 0
    pool.emitter.on(PoolEvents.destroy, () => ++poolDestroy)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.destroy])
    await pool.destroy()
    const exitEvents = await exitPromise
    expect(pool.info.started).toBe(false)
    expect(pool.info.ready).toBe(false)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.destroy])
    expect(pool.workerNodes.length).toBe(0)
    expect(exitEvents).toBe(numberOfWorkers)
    expect(poolDestroy).toBe(1)
  })

  it('Verify that cluster pool options are checked', async () => {
    const workerFilePath = './tests/worker-files/cluster/testWorker.cjs'
    let pool = new FixedClusterPool(numberOfWorkers, workerFilePath)
    expect(pool.opts.env).toBeUndefined()
    expect(pool.opts.settings).toBeUndefined()
    expect(cluster.settings).toMatchObject({
      exec: workerFilePath,
      silent: false,
    })
    await pool.destroy()
    pool = new FixedClusterPool(numberOfWorkers, workerFilePath, {
      env: { TEST: 'test' },
      settings: { args: ['--use', 'http'], silent: true },
    })
    expect(pool.opts.env).toStrictEqual({ TEST: 'test' })
    expect(pool.opts.settings).toStrictEqual({
      args: ['--use', 'http'],
      silent: true,
    })
    expect(cluster.settings).toMatchObject({
      args: ['--use', 'http'],
      exec: workerFilePath,
      silent: true,
    })
    await pool.destroy()
  })

  it('Verify destroyWorkerNode()', async () => {
    const workerFilePath = './tests/worker-files/cluster/testWorker.cjs'
    const pool = new FixedClusterPool(numberOfWorkers, workerFilePath)
    const workerNodeKey = 0
    let disconnectEvent = 0
    pool.workerNodes[workerNodeKey].worker.on('disconnect', () => {
      ++disconnectEvent
    })
    let exitEvent = 0
    pool.workerNodes[workerNodeKey].worker.on('exit', () => {
      ++exitEvent
    })
    await expect(pool.destroyWorkerNode(workerNodeKey)).resolves.toBeUndefined()
    expect(disconnectEvent).toBe(1)
    expect(exitEvent).toBe(1)
    // Simulates an illegitimate worker node destroy and the minimum number of worker nodes is guaranteed
    expect(pool.workerNodes.length).toBe(numberOfWorkers)
    await sleep(500)
    await pool.destroy()
  })

  it('Verify that a pool with zero worker fails', () => {
    expect(
      () =>
        new FixedClusterPool(0, './tests/worker-files/cluster/testWorker.cjs')
    ).toThrow('Cannot instantiate a fixed pool with zero worker')
  })
})
