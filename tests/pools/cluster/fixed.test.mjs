import cluster from 'node:cluster'

import { expect } from 'expect'

import { FixedClusterPool, PoolEvents } from '../../../lib/index.cjs'
import { DEFAULT_TASK_NAME } from '../../../lib/utils.cjs'
import { TaskFunctions } from '../../test-types.cjs'
import { waitPoolEvents, waitWorkerEvents } from '../../test-utils.cjs'

describe('Fixed cluster pool test suite', () => {
  const numberOfWorkers = 8
  const tasksConcurrency = 2
  const pool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/testWorker.cjs',
    {
      errorHandler: e => console.error(e),
    }
  )
  const queuePool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/testWorker.cjs',
    {
      enableTasksQueue: true,
      tasksQueueOptions: {
        concurrency: tasksConcurrency,
      },
      errorHandler: e => console.error(e),
    }
  )
  const emptyPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/emptyWorker.cjs',
    { exitHandler: () => console.info('empty pool worker exited') }
  )
  const echoPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/echoWorker.cjs'
  )
  const errorPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/errorWorker.cjs',
    {
      errorHandler: e => console.error(e),
    }
  )
  const asyncErrorPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/asyncErrorWorker.cjs',
    {
      errorHandler: e => console.error(e),
    }
  )
  const asyncPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/asyncWorker.cjs'
  )

  after('Destroy all pools', async () => {
    // We need to clean up the resources after our test
    await echoPool.destroy()
    await asyncPool.destroy()
    await errorPool.destroy()
    await asyncErrorPool.destroy()
    await emptyPool.destroy()
    await queuePool.destroy()
  })

  it('Verify that the function is executed in a worker cluster', async () => {
    let result = await pool.execute({
      function: TaskFunctions.fibonacci,
    })
    expect(result).toBe(354224848179262000000)
    result = await pool.execute({
      function: TaskFunctions.factorial,
    })
    expect(result).toBe(9.33262154439441e157)
  })

  it('Verify that is possible to invoke the execute() method without input', async () => {
    const result = await pool.execute()
    expect(result).toStrictEqual({ ok: 1 })
  })

  it("Verify that 'ready' event is emitted", async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    let poolReady = 0
    pool.emitter.on(PoolEvents.ready, () => ++poolReady)
    await waitPoolEvents(pool, PoolEvents.ready, 1)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.ready])
    expect(poolReady).toBe(1)
    await pool.destroy()
  })

  it("Verify that 'busy' event is emitted", async () => {
    const promises = new Set()
    expect(pool.emitter.eventNames()).toStrictEqual([])
    let poolBusy = 0
    pool.emitter.on(PoolEvents.busy, () => ++poolBusy)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.busy])
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
    // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the fixed pool.
    expect(poolBusy).toBe(numberOfWorkers + 1)
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
      expect(workerNode.usage.tasks.executed).toBe(maxMultiplier)
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

  it('Verify that error handling is working properly:sync', async () => {
    const data = { f: 10 }
    expect(errorPool.emitter.eventNames()).toStrictEqual([])
    let taskError
    errorPool.emitter.on(PoolEvents.taskError, e => {
      taskError = e
    })
    expect(errorPool.emitter.eventNames()).toStrictEqual([PoolEvents.taskError])
    let inError
    try {
      await errorPool.execute(data)
    } catch (e) {
      inError = e
    }
    expect(inError).toBeDefined()
    expect(typeof inError === 'string').toBe(true)
    expect(inError).toBe('Error Message from ClusterWorker')
    expect(taskError).toStrictEqual({
      name: DEFAULT_TASK_NAME,
      message: 'Error Message from ClusterWorker',
      data,
    })
    expect(
      errorPool.workerNodes.some(
        workerNode => workerNode.usage.tasks.failed === 1
      )
    ).toBe(true)
  })

  it('Verify that error handling is working properly:async', async () => {
    const data = { f: 10 }
    expect(asyncErrorPool.emitter.eventNames()).toStrictEqual([])
    let taskError
    asyncErrorPool.emitter.on(PoolEvents.taskError, e => {
      taskError = e
    })
    expect(asyncErrorPool.emitter.eventNames()).toStrictEqual([
      PoolEvents.taskError,
    ])
    let inError
    try {
      await asyncErrorPool.execute(data)
    } catch (e) {
      inError = e
    }
    expect(inError).toBeDefined()
    expect(typeof inError === 'string').toBe(true)
    expect(inError).toBe('Error Message from ClusterWorker:async')
    expect(taskError).toStrictEqual({
      name: DEFAULT_TASK_NAME,
      message: 'Error Message from ClusterWorker:async',
      data,
    })
    expect(
      asyncErrorPool.workerNodes.some(
        workerNode => workerNode.usage.tasks.failed === 1
      )
    ).toBe(true)
  })

  it('Verify that async function is working properly', async () => {
    const data = { f: 10 }
    const startTime = performance.now()
    const result = await asyncPool.execute(data)
    const usedTime = performance.now() - startTime
    expect(result).toStrictEqual(data)
    expect(usedTime).toBeGreaterThanOrEqual(2000)
  })

  it('Shutdown test', async () => {
    const exitPromise = waitWorkerEvents(pool, 'exit', numberOfWorkers)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.busy])
    let poolDestroy = 0
    pool.emitter.on(PoolEvents.destroy, () => ++poolDestroy)
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.busy,
      PoolEvents.destroy,
    ])
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(pool.started).toBe(false)
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.busy,
      PoolEvents.destroy,
    ])
    expect(pool.readyEventEmitted).toBe(false)
    expect(pool.workerNodes.length).toBe(0)
    expect(numberOfExitEvents).toBe(numberOfWorkers)
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
      silent: true,
      exec: workerFilePath,
    })
    await pool.destroy()
  })

  it('Should work even without opts in input', async () => {
    const workerFilePath = './tests/worker-files/cluster/testWorker.cjs'
    const pool = new FixedClusterPool(numberOfWorkers, workerFilePath)
    const res = await pool.execute()
    expect(res).toStrictEqual({ ok: 1 })
    // We need to clean up the resources after our test
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
    await pool.destroy()
  })

  it('Verify that a pool with zero worker fails', () => {
    expect(
      () =>
        new FixedClusterPool(0, './tests/worker-files/cluster/testWorker.cjs')
    ).toThrow('Cannot instantiate a fixed pool with zero worker')
  })
})
