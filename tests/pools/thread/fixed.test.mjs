import { expect } from 'expect'

import { FixedThreadPool, PoolEvents } from '../../../lib/index.cjs'
import { DEFAULT_TASK_NAME } from '../../../lib/utils.cjs'
import { TaskFunctions } from '../../test-types.cjs'
import { waitWorkerEvents } from '../../test-utils.cjs'

describe('Fixed thread pool test suite', () => {
  const numberOfThreads = 6
  const tasksConcurrency = 2
  let asyncErrorPool, asyncPool, echoPool, emptyPool, errorPool, pool, queuePool

  before('Create pools', () => {
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
    errorPool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/errorWorker.mjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    asyncErrorPool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/asyncErrorWorker.mjs',
      {
        errorHandler: e => console.error(e),
      }
    )
    asyncPool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/asyncWorker.mjs'
    )
  })

  after('Destroy pools', async () => {
    // We need to clean up the resources after our tests
    await echoPool.destroy()
    await asyncPool.destroy()
    await errorPool.destroy()
    await asyncErrorPool.destroy()
    await emptyPool.destroy()
    await queuePool.destroy()
  })

  it('Verify that the function is executed in a worker thread', async () => {
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
      expect(workerNode.usage.tasks.executed).toBe(maxMultiplier)
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
      result = await pool.execute(undefined, undefined, [
        new ArrayBuffer(16),
        new MessageChannel().port1,
      ])
    } catch (e) {
      error = e
    }
    expect(result).toStrictEqual({ ok: 1 })
    expect(error).toBeUndefined()
    try {
      result = await pool.execute(undefined, undefined, [
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
    expect(inError).toBeInstanceOf(Error)
    expect(inError.message).toStrictEqual('Error Message from ThreadWorker')
    expect(typeof inError.stack === 'string').toBe(true)
    expect(taskError).toStrictEqual({
      data,
      error: inError,
      message: inError.message,
      name: DEFAULT_TASK_NAME,
      stack: inError.stack,
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
    expect(inError).toBeInstanceOf(Error)
    expect(inError.message).toStrictEqual(
      'Error Message from ThreadWorker:async'
    )
    expect(typeof inError.stack === 'string').toBe(true)
    expect(taskError).toStrictEqual({
      data,
      error: inError,
      message: inError.message,
      name: DEFAULT_TASK_NAME,
      stack: inError.stack,
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
    const exitPromise = waitWorkerEvents(pool, 'exit', numberOfThreads)
    expect(pool.emitter.eventNames()).toStrictEqual([])
    let poolDestroy = 0
    pool.emitter.on(PoolEvents.destroy, () => ++poolDestroy)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.destroy])
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(pool.info.started).toBe(false)
    expect(pool.info.ready).toBe(false)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.destroy])
    expect(pool.readyEventEmitted).toBe(false)
    expect(pool.busyEventEmitted).toBe(false)
    expect(pool.backPressureEventEmitted).toBe(false)
    expect(pool.workerNodes.length).toBe(0)
    expect(numberOfExitEvents).toBe(numberOfThreads)
    expect(poolDestroy).toBe(1)
  })

  it('Verify that thread pool options are checked', async () => {
    const workerFilePath = './tests/worker-files/thread/testWorker.mjs'
    let pool = new FixedThreadPool(numberOfThreads, workerFilePath)
    expect(pool.opts.workerOptions).toBeUndefined()
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
    await pool.destroy()
  })

  it('Verify that a pool with zero worker fails', () => {
    expect(
      () => new FixedThreadPool(0, './tests/worker-files/thread/testWorker.mjs')
    ).toThrow('Cannot instantiate a fixed pool with zero worker')
  })
})
