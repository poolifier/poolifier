import { beforeAll, describe, expect, it } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../../lib/index.mjs'
import { sleep, waitWorkerEvents } from '../../test-utils.cjs'

describe('Fixed thread pool lifecycle test suite', () => {
  const numberOfThreads = 6
  let pool

  beforeAll(async () => {
    pool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/testWorker.mjs',
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
    const exitPromise = waitWorkerEvents(pool, 'exit', numberOfThreads)
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
    expect(exitEvents).toBe(numberOfThreads)
    expect(poolDestroy).toBe(1)
  })

  it('Verify that thread pool options are checked', async () => {
    const workerFilePath = './tests/worker-files/thread/testWorker.mjs'
    let pool = new FixedThreadPool(numberOfThreads, workerFilePath)
    expect(pool.opts.workerOptions).toBeUndefined()
    await sleep(500)
    await pool.destroy()
    pool = new FixedThreadPool(numberOfThreads, workerFilePath, {
      workerOptions: {
        env: { TEST: 'test' },
        name: 'test',
      },
    })
    expect(pool.opts.workerOptions).toStrictEqual({
      env: { TEST: 'test' },
      name: 'test',
    })
    await sleep(500)
    await pool.destroy()
  })

  it('Verify destroyWorkerNode()', async () => {
    const workerFilePath = './tests/worker-files/thread/testWorker.mjs'
    const pool = new FixedThreadPool(numberOfThreads, workerFilePath)
    const workerNodeKey = 0
    let exitEvent = 0
    pool.workerNodes[workerNodeKey].worker.on('exit', () => {
      ++exitEvent
    })
    await expect(pool.destroyWorkerNode(workerNodeKey)).resolves.toBeUndefined()
    expect(exitEvent).toBe(1)
    // Simulates an illegitimate worker node destroy and the minimum number of worker nodes is guaranteed
    expect(pool.workerNodes.length).toBe(numberOfThreads)
    await sleep(500)
    await pool.destroy()
  })

  it('Verify that a pool with zero worker fails', () => {
    expect(
      () => new FixedThreadPool(0, './tests/worker-files/thread/testWorker.mjs')
    ).toThrow('Cannot instantiate a fixed pool with zero worker')
  })
})
