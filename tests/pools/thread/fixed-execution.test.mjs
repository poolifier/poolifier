import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../../lib/index.mjs'
import { TaskFunctions } from '../../test-types.cjs'

describe('Fixed thread pool execution test suite', () => {
  const numberOfThreads = 6
  const tasksConcurrency = 2
  let echoPool, emptyPool, pool, queuePool

  beforeAll(async () => {
    pool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/testWorker.mjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    queuePool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/testWorker.mjs',
      {
        enableTasksQueue: true,
        errorHandler: e => console.error(e),
        tasksQueueOptions: {
          concurrency: tasksConcurrency,
        },
      }
    )
    emptyPool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/emptyWorker.mjs',
      { exitHandler: () => console.info('empty pool worker exited') }
    )
    echoPool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/echoWorker.mjs'
    )
    await Promise.all(
      [pool, queuePool, emptyPool, echoPool].map(async currentPool => {
        if (!currentPool.info.ready) {
          await new Promise(resolve =>
            currentPool.emitter.once(PoolEvents.ready, resolve)
          )
        }
      })
    )
  })

  afterAll(async () => {
    if (process.env.CI != null) return
    await echoPool.destroy()
    await emptyPool.destroy()
    await queuePool.destroy()
    await pool.destroy()
  })

  it('Verify that the function is executed in a worker thread', async () => {
    let result = await pool.execute(
      {
        function: TaskFunctions.fibonacci,
      },
      'default',
      AbortSignal.timeout(2000)
    )
    expect(result).toBe(354224848179262000000)
    result = await pool.execute(
      {
        function: TaskFunctions.factorial,
      },
      'default',
      AbortSignal.timeout(2000)
    )
    expect(result).toBe(9.33262154439441e157)
  })

  it('Verify that is possible to invoke the execute() method without input', async () => {
    const result = await pool.execute()
    expect(result).toStrictEqual({ ok: 1 })
  })

  it('Verify that tasks queuing is working', async () => {
    const promises = new Set()
    const maxMultiplier = 3 // Must be greater than tasksConcurrency
    for (let i = 0; i < numberOfThreads * maxMultiplier; i++) {
      promises.add(queuePool.execute())
    }
    expect(promises.size).toBe(numberOfThreads * maxMultiplier)
    for (const workerNode of queuePool.workerNodes) {
      expect(workerNode.usage.tasks.executing).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executing).toBeLessThanOrEqual(
        queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.executed).toBe(0)
      expect(workerNode.usage.tasks.queued).toBe(
        maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.maxQueued).toBe(
        maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.sequentiallyStolen).toBe(0)
      expect(workerNode.usage.tasks.stolen).toBe(0)
    }
    expect(queuePool.info.executedTasks).toBe(0)
    expect(queuePool.info.executingTasks).toBe(
      numberOfThreads * queuePool.opts.tasksQueueOptions.concurrency
    )
    expect(queuePool.info.queuedTasks).toBe(
      numberOfThreads *
        (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency)
    )
    expect(queuePool.info.maxQueuedTasks).toBe(
      numberOfThreads *
        (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency)
    )
    expect(queuePool.info.backPressure).toBe(false)
    expect(queuePool.info.stolenTasks).toBe(0)
    await Promise.all(promises)
    for (const workerNode of queuePool.workerNodes) {
      expect(workerNode.usage.tasks.executing).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executing).toBeLessThanOrEqual(
        numberOfThreads * maxMultiplier
      )
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.queued).toBe(0)
      expect(workerNode.usage.tasks.maxQueued).toBe(
        maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.sequentiallyStolen).toBeGreaterThanOrEqual(
        0
      )
      expect(workerNode.usage.tasks.sequentiallyStolen).toBeLessThanOrEqual(
        numberOfThreads * maxMultiplier
      )
      expect(workerNode.usage.tasks.stolen).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.stolen).toBeLessThanOrEqual(
        numberOfThreads * maxMultiplier
      )
    }
    expect(
      queuePool.workerNodes.reduce(
        (total, workerNode) => total + workerNode.usage.tasks.executed,
        0
      )
    ).toBe(numberOfThreads * maxMultiplier)
    expect(queuePool.info.executedTasks).toBe(numberOfThreads * maxMultiplier)
    expect(queuePool.info.backPressure).toBe(false)
    expect(queuePool.info.stolenTasks).toBeGreaterThanOrEqual(0)
    expect(queuePool.info.stolenTasks).toBeLessThanOrEqual(
      numberOfThreads * maxMultiplier
    )
  })

  it('Verify that is possible to have a worker that return undefined', async () => {
    const result = await emptyPool.execute()
    expect(result).toBeUndefined()
  })

  it('Verify that data are sent to the worker correctly', async () => {
    const data = { f: 10 }
    const result = await echoPool.execute(data)
    expect(result).toStrictEqual(data)
  })

  it('Verify that transferable objects are sent to the worker correctly', async () => {
    let error
    let result
    try {
      result = await pool.execute(undefined, undefined, undefined, [
        new ArrayBuffer(16),
        new MessageChannel().port1,
      ])
    } catch (e) {
      error = e
    }
    expect(result).toStrictEqual({ ok: 1 })
    expect(error).toBeUndefined()
    try {
      result = await pool.execute(undefined, undefined, undefined, [
        new SharedArrayBuffer(16),
      ])
    } catch (e) {
      error = e
    }
    expect(result).toStrictEqual({ ok: 1 })
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(
      /Found invalid (object|value) in transferList/
    )
  })
})
