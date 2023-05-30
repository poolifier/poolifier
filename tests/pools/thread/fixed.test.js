const { expect } = require('expect')
const { FixedThreadPool, PoolEvents } = require('../../../lib')
const { WorkerFunctions } = require('../../test-types')
const TestUtils = require('../../test-utils')

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
    expect(result).toBe(121393)
    result = await pool.execute({
      function: WorkerFunctions.factorial
    })
    expect(result).toBe(9.33262154439441e157)
  })

  it('Verify that is possible to invoke the execute() method without input', async () => {
    const result = await pool.execute()
    expect(result).toBe(false)
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
    const maxMultiplier = 2
    const promises = new Set()
    for (let i = 0; i < numberOfThreads * maxMultiplier; i++) {
      promises.add(queuePool.execute())
    }
    expect(promises.size).toBe(numberOfThreads * maxMultiplier)
    for (const workerNode of queuePool.workerNodes) {
      expect(workerNode.tasksUsage.running).toBeLessThanOrEqual(
        queuePool.opts.tasksQueueOptions.concurrency
      )
      expect(workerNode.tasksUsage.run).toBe(0)
      expect(workerNode.tasksQueue.size).toBeGreaterThan(0)
    }
    expect(queuePool.numberOfRunningTasks).toBe(numberOfThreads)
    expect(queuePool.numberOfQueuedTasks).toBe(
      numberOfThreads * maxMultiplier - numberOfThreads
    )
    await Promise.all(promises)
    for (const workerNode of queuePool.workerNodes) {
      expect(workerNode.tasksUsage.running).toBe(0)
      expect(workerNode.tasksUsage.run).toBeGreaterThan(0)
      expect(workerNode.tasksQueue.size).toBe(0)
    }
    promises.clear()
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
    expect(
      errorPool.workerNodes.some(
        workerNode => workerNode.tasksUsage.error === 1
      )
    ).toBe(true)
  })

  it('Verify that error handling is working properly:async', async () => {
    const data = { f: 10 }
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
    expect(
      asyncErrorPool.workerNodes.some(
        workerNode => workerNode.tasksUsage.error === 1
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
    const exitPromise = TestUtils.waitExits(pool, numberOfThreads)
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(numberOfExitEvents).toBe(numberOfThreads)
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/testWorker.js'
    )
    const res = await pool1.execute()
    expect(res).toBe(false)
    // We need to clean up the resources after our test
    await pool1.destroy()
  })

  it('Verify that a pool with zero worker fails', async () => {
    expect(
      () => new FixedThreadPool(0, './tests/worker-files/thread/testWorker.js')
    ).toThrowError('Cannot instantiate a fixed pool with no worker')
  })
})
