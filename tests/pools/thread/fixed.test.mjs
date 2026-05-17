import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../../lib/index.mjs'
import { DEFAULT_TASK_NAME } from '../../../lib/utils.mjs'
import { TaskFunctions } from '../../test-types.cjs'
import { sleep, waitWorkerEvents } from '../../test-utils.cjs'

describe('Fixed thread pool test suite', () => {
  const numberOfThreads = 6
  const tasksConcurrency = 2
  let asyncErrorPool,
    asyncPool,
    crashPool,
    echoPool,
    emptyPool,
    errorPool,
    pool,
    queuePool

  beforeAll(() => {
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
    crashPool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/crashWorker.mjs',
      {
        enableTasksQueue: true,
        restartWorkerOnError: false,
        tasksQueueOptions: { concurrency: 1 },
      }
    )
  })

  afterAll(async () => {
    // Skip on CI to avoid afterAll hook timeout
    if (process.env.CI != null) return
    // We need to clean up the resources after our tests
    await echoPool.destroy()
    await asyncPool.destroy()
    await errorPool.destroy()
    await asyncErrorPool.destroy()
    await emptyPool.destroy()
    await queuePool.destroy()
    await crashPool.destroy()
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
      // Per-worker `executed` and steal counters are non-deterministic
      // because tasks-stealing-on-idle redistributes work across nodes;
      // bounds reflect that distribution rather than exact equality.
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(
        queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        numberOfThreads *
          (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency) +
          queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.queued).toBe(0)
      expect(workerNode.usage.tasks.maxQueued).toBe(
        maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.sequentiallyStolen).toBeGreaterThanOrEqual(
        0
      )
      expect(workerNode.usage.tasks.sequentiallyStolen).toBeLessThanOrEqual(
        numberOfThreads *
          (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency)
      )
      expect(workerNode.usage.tasks.stolen).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.stolen).toBeLessThanOrEqual(
        numberOfThreads *
          (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency)
      )
    }
    expect(queuePool.info.executedTasks).toBe(numberOfThreads * maxMultiplier)
    expect(queuePool.info.backPressure).toBe(false)
    expect(queuePool.info.stolenTasks).toBeGreaterThanOrEqual(0)
    expect(queuePool.info.stolenTasks).toBeLessThanOrEqual(
      numberOfThreads *
        (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency)
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
      aborted: false,
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
      aborted: false,
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

  // Discriminate via `error.name` (NOT instanceof — dual-package
  // safety). `{ retry: 0 }` because the test is deterministic.
  it('Verify that in-flight task promises reject on worker crash', {
    retry: 0,
  }, async () => {
    let poolError
    crashPool.emitter.once(PoolEvents.error, e => {
      poolError = e
    })
    const exitPromise = waitWorkerEvents(crashPool, 'exit', 1)
    let error
    try {
      await crashPool.execute()
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('WorkerCrashError')
    expect(error.cause).toBeInstanceOf(Error)
    expect(error.cause.message).toBe('Simulated worker crash')
    expect(poolError).toBeInstanceOf(Error)
    expect(poolError.name).toBe('WorkerCrashError')
    expect(poolError.cause.message).toBe('Simulated worker crash')
    await exitPromise
  })

  it('Verify that async function is working properly', async () => {
    const data = { f: 10 }
    const startTime = performance.now()
    const result = await asyncPool.execute(data)
    const usedTime = performance.now() - startTime
    expect(result).toStrictEqual(data)
    expect(usedTime).toBeGreaterThanOrEqual(2000)
  })

  it('Verify that task can be aborted', async () => {
    let error

    try {
      await asyncErrorPool.execute({}, 'default', AbortSignal.timeout(500))
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TimeoutError')
    expect(error.message).toBe('The operation was aborted due to timeout')
    expect(error.stack).toBeDefined()

    const abortController = new AbortController()
    setTimeout(() => {
      abortController.abort(new Error('Task aborted'))
    }, 500)
    try {
      await asyncErrorPool.execute({}, 'default', abortController.signal)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Task aborted')
    expect(error.stack).toBeDefined()
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
    expect(pool.readyEventEmitted).toBe(false)
    expect(pool.busyEventEmitted).toBe(false)
    expect(pool.backPressureEventEmitted).toBe(false)
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
