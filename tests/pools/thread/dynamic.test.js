const { expect } = require('expect')
const { DynamicThreadPool, PoolEvents } = require('../../../lib/index')
const { WorkerFunctions } = require('../../test-types')
const TestUtils = require('../../test-utils')

describe('Dynamic thread pool test suite', () => {
  const min = 1
  const max = 3
  const pool = new DynamicThreadPool(
    min,
    max,
    './tests/worker-files/thread/testWorker.js',
    {
      errorHandler: e => console.error(e)
    }
  )

  it('Verify that the function is executed in a worker thread', async () => {
    let result = await pool.execute({
      function: WorkerFunctions.fibonacci
    })
    expect(result).toBe(false)
    result = await pool.execute({
      function: WorkerFunctions.factorial
    })
    expect(result).toBe(false)
  })

  it('Verify that new workers are created when required, max size is not exceeded and that after a while new workers will die', async () => {
    let poolBusy = 0
    pool.emitter.on(PoolEvents.busy, () => ++poolBusy)
    for (let i = 0; i < max * 2; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBeLessThanOrEqual(max)
    expect(pool.workerNodes.length).toBeGreaterThan(min)
    // The `busy` event is triggered when the number of submitted tasks at once reach the max number of workers in the dynamic pool.
    // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the dynamic pool.
    expect(poolBusy).toBe(max + 1)
    const numberOfExitEvents = await TestUtils.waitExits(pool, max - min)
    expect(numberOfExitEvents).toBe(max - min)
  })

  it('Verify scale thread up and down is working', async () => {
    expect(pool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBe(max)
    await TestUtils.waitExits(pool, max - min)
    expect(pool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBe(max)
    await TestUtils.waitExits(pool, max - min)
    expect(pool.workerNodes.length).toBe(min)
  })

  it('Shutdown test', async () => {
    const exitPromise = TestUtils.waitExits(pool, min)
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(numberOfExitEvents).toBe(min)
  })

  it('Validation of inputs test', () => {
    expect(() => new DynamicThreadPool(min)).toThrowError(
      new Error('Please specify a file with a worker implementation')
    )
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    const res = await pool1.execute()
    expect(res).toBe(false)
    // We need to clean up the resources after our test
    await pool1.destroy()
  })

  it('Verify scale thread up and down is working when long running task is used:hard', async () => {
    const longRunningPool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/longRunningWorkerHardBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.log('long running worker is online'),
        exitHandler: () => console.log('long running worker exited')
      }
    )
    expect(longRunningPool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      longRunningPool.execute()
    }
    expect(longRunningPool.workerNodes.length).toBe(max)
    await TestUtils.waitExits(longRunningPool, max - min)
    expect(longRunningPool.workerNodes.length).toBe(min)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
  })

  it('Verify scale thread up and down is working when long running task is used:soft', async () => {
    const longRunningPool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/longRunningWorkerSoftBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.log('long running worker is online'),
        exitHandler: () => console.log('long running worker exited')
      }
    )
    expect(longRunningPool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      longRunningPool.execute()
    }
    expect(longRunningPool.workerNodes.length).toBe(max)
    await TestUtils.sleep(1500)
    // Here we expect the workerNodes to be at the max size since the task is still running
    expect(longRunningPool.workerNodes.length).toBe(max)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
  })

  it('Verify that a pool with zero worker can be instantiated', async () => {
    const pool = new DynamicThreadPool(
      0,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(pool).toBeInstanceOf(DynamicThreadPool)
    // We need to clean up the resources after our test
    await pool.destroy()
  })
})
