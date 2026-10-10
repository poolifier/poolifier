import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FixedClusterPool, PoolEvents } from '../../../lib/index.mjs'
import { TaskFunctions } from '../../test-types.cjs'

describe('Fixed cluster pool execution test suite', () => {
  const numberOfWorkers = 8
  const tasksConcurrency = 2
  let echoPool, emptyPool, pool, queuePool

  beforeAll(async () => {
    pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    queuePool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs',
      {
        enableTasksQueue: true,
        errorHandler: e => console.error(e),
        tasksQueueOptions: {
          concurrency: tasksConcurrency,
        },
      }
    )
    emptyPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/emptyWorker.cjs',
      { exitHandler: () => console.info('empty pool worker exited') }
    )
    echoPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/echoWorker.cjs'
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

  it('Verify that the function is executed in a worker cluster', async () => {
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
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      promises.add(queuePool.execute())
    }
    expect(promises.size).toBe(numberOfWorkers * maxMultiplier)
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
      numberOfWorkers * queuePool.opts.tasksQueueOptions.concurrency
    )
    expect(queuePool.info.queuedTasks).toBe(
      numberOfWorkers *
        (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency)
    )
    expect(queuePool.info.maxQueuedTasks).toBe(
      numberOfWorkers *
        (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency)
    )
    expect(queuePool.info.backPressure).toBe(false)
    expect(queuePool.info.stolenTasks).toBe(0)
    await Promise.all(promises)
    for (const workerNode of queuePool.workerNodes) {
      expect(workerNode.usage.tasks.executing).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executing).toBeLessThanOrEqual(
        numberOfWorkers * maxMultiplier
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
        numberOfWorkers * maxMultiplier
      )
      expect(workerNode.usage.tasks.stolen).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.stolen).toBeLessThanOrEqual(
        numberOfWorkers * maxMultiplier
      )
    }
    expect(
      queuePool.workerNodes.reduce(
        (total, workerNode) => total + workerNode.usage.tasks.executed,
        0
      )
    ).toBe(numberOfWorkers * maxMultiplier)
    expect(queuePool.info.executedTasks).toBe(numberOfWorkers * maxMultiplier)
    expect(queuePool.info.backPressure).toBe(false)
    expect(queuePool.info.stolenTasks).toBeGreaterThanOrEqual(0)
    expect(queuePool.info.stolenTasks).toBeLessThanOrEqual(
      numberOfWorkers * maxMultiplier
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
})
