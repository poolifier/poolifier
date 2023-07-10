const { expect } = require('expect')
const { FixedThreadPool, PoolEvents } = require('../../../lib')
const { WorkerFunctions } = require('../../test-types')
const { waitPoolEvents, waitWorkerEvents } = require('../../test-utils')

describe('Fixed thread pool test suite', () => {
  const numberOfThreads = 6
  const pool = new FixedThreadPool(
    numberOfThreads,
    './tests/worker-files/thread/testWorker.js',
    {
      errorHandler: e => console.error(e)
    }
  )
  const queuePool = new FixedThreadPool(
    numberOfThreads,
    './tests/worker-files/thread/testWorker.js',
    {
      enableTasksQueue: true,
      tasksQueueOptions: {
        concurrency: 2
      },
      errorHandler: e => console.error(e)
    }
  )
  const emptyPool = new FixedThreadPool(
    numberOfThreads,
    './tests/worker-files/thread/emptyWorker.js',
    { exitHandler: () => console.log('empty pool worker exited') }
  )
  const echoPool = new FixedThreadPool(
    numberOfThreads,
    './tests/worker-files/thread/echoWorker.js'
  )
  const errorPool = new FixedThreadPool(
    numberOfThreads,
    './tests/worker-files/thread/errorWorker.js',
    {
      errorHandler: e => console.error(e)
    }
  )
  const asyncErrorPool = new FixedThreadPool(
    numberOfThreads,
    './tests/worker-files/thread/asyncErrorWorker.js',
    {
      errorHandler: e => console.error(e)
    }
  )
  const asyncPool = new FixedThreadPool(
    numberOfThreads,
    './tests/worker-files/thread/asyncWorker.js'
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

  it('Verify that the function is executed in a worker thread', async () => {
    let result = await pool.execute({
      function: WorkerFunctions.fibonacci
    })
    expect(result).toBe(75025)
    result = await pool.execute({
      function: WorkerFunctions.factorial
    })
    expect(result).toBe(9.33262154439441e157)
  })

  it('Verify that is possible to invoke the execute() method without input', async () => {
    const result = await pool.execute()
    expect(result).toStrictEqual({ ok: 1 })
  })

  it("Verify that 'ready' event is emitted", async () => {
    const pool1 = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    let poolReady = 0
    pool1.emitter.on(PoolEvents.ready, () => ++poolReady)
    if (!pool1.info.ready) {
      await waitPoolEvents(pool1, PoolEvents.ready, 1)
    }
    expect(poolReady).toBe(1)
  })

  it("Verify that 'busy' event is emitted", async () => {
    let poolBusy = 0
    pool.emitter.on(PoolEvents.busy, () => ++poolBusy)
    for (let i = 0; i < numberOfThreads * 2; i++) {
      pool.execute()
    }
    // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
    // So in total numberOfThreads + 1 times for a loop submitting up to numberOfThreads * 2 tasks to the fixed pool.
    expect(poolBusy).toBe(numberOfThreads + 1)
  })

  it('Verify that tasks queuing is working', async () => {
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < numberOfThreads * maxMultiplier; i++) {
      promises.add(queuePool.execute())
    }
    expect(promises.size).toBe(numberOfThreads * maxMultiplier)
    for (const workerNode of queuePool.workerNodes) {
      expect(workerNode.usage.tasks.executing).toBeLessThanOrEqual(
        queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.usage.tasks.executed).toBe(0)
      expect(workerNode.usage.tasks.queued).toBeGreaterThan(0)
      expect(workerNode.usage.tasks.maxQueued).toBeGreaterThan(0)
    }
    expect(queuePool.info.executingTasks).toBe(numberOfThreads)
    expect(queuePool.info.queuedTasks).toBe(
      numberOfThreads * maxMultiplier - numberOfThreads
    )
    expect(queuePool.info.maxQueuedTasks).toBe(
      numberOfThreads * maxMultiplier - numberOfThreads
    )
    await Promise.all(promises)
    for (const workerNode of queuePool.workerNodes) {
      expect(workerNode.usage.tasks.executing).toBe(0)
      expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(maxMultiplier)
      expect(workerNode.usage.tasks.queued).toBe(0)
      expect(workerNode.usage.tasks.maxQueued).toBe(1)
    }
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
    let taskError
    errorPool.emitter.on(PoolEvents.taskError, e => {
      taskError = e
    })
    let inError
    try {
      await errorPool.execute(data)
    } catch (e) {
      inError = e
    }
    expect(inError).toBeDefined()
    expect(inError).toBeInstanceOf(Error)
    expect(inError.message).toBeDefined()
    expect(typeof inError.message === 'string').toBe(true)
    expect(inError.message).toBe('Error Message from ThreadWorker')
    expect(taskError).toStrictEqual({
      name: 'default',
      message: new Error('Error Message from ThreadWorker'),
      data
    })
    expect(
      errorPool.workerNodes.some(
        workerNode => workerNode.usage.tasks.failed === 1
      )
    ).toBe(true)
  })

  it('Verify that error handling is working properly:async', async () => {
    const data = { f: 10 }
    let taskError
    asyncErrorPool.emitter.on(PoolEvents.taskError, e => {
      taskError = e
    })
    let inError
    try {
      await asyncErrorPool.execute(data)
    } catch (e) {
      inError = e
    }
    expect(inError).toBeDefined()
    expect(inError).toBeInstanceOf(Error)
    expect(inError.message).toBeDefined()
    expect(typeof inError.message === 'string').toBe(true)
    expect(inError.message).toBe('Error Message from ThreadWorker:async')
    expect(taskError).toStrictEqual({
      name: 'default',
      message: new Error('Error Message from ThreadWorker:async'),
      data
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
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(numberOfExitEvents).toBe(numberOfThreads)
  })

  it('Verify that thread pool options are checked', async () => {
    const workerFilePath = './tests/worker-files/thread/testWorker.js'
    let pool1 = new FixedThreadPool(numberOfThreads, workerFilePath)
    expect(pool1.opts.workerOptions).toBeUndefined()
    await pool1.destroy()
    pool1 = new FixedThreadPool(numberOfThreads, workerFilePath, {
      workerOptions: {
        env: { TEST: 'test' },
        name: 'test'
      }
    })
    expect(pool1.opts.workerOptions).toStrictEqual({
      env: { TEST: 'test' },
      name: 'test'
    })
    await pool1.destroy()
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/testWorker.js'
    )
    const res = await pool1.execute()
    expect(res).toStrictEqual({ ok: 1 })
    // We need to clean up the resources after our test
    await pool1.destroy()
  })

  it('Verify that a pool with zero worker fails', async () => {
    expect(
      () => new FixedThreadPool(0, './tests/worker-files/thread/testWorker.js')
    ).toThrowError('Cannot instantiate a fixed pool with zero worker')
  })
})
