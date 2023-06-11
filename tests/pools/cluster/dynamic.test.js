const { expect } = require('expect')
const { DynamicClusterPool, PoolEvents } = require('../../../lib')
const { WorkerFunctions } = require('../../test-types')
const TestUtils = require('../../test-utils')

describe('Dynamic cluster pool test suite', () => {
  const min = 1
  const max = 3
  const pool = new DynamicClusterPool(
    min,
    max,
    './tests/worker-files/cluster/testWorker.js',
    {
      errorHandler: e => console.error(e)
    }
  )

  it('Verify that the function is executed in a worker cluster', async () => {
    let result = await pool.execute({
      function: WorkerFunctions.fibonacci
    })
    expect(result).toBe(121393)
    result = await pool.execute({
      function: WorkerFunctions.factorial
    })
    expect(result).toBe(9.33262154439441e157)
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
    const numberOfExitEvents = await TestUtils.waitWorkerExits(pool, max - min)
    expect(numberOfExitEvents).toBe(max - min)
  })

  it('Verify scale worker up and down is working', async () => {
    expect(pool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 2; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBeGreaterThan(min)
    await TestUtils.waitWorkerExits(pool, max - min)
    expect(pool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 2; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBeGreaterThan(min)
    await TestUtils.waitWorkerExits(pool, max - min)
    expect(pool.workerNodes.length).toBe(min)
  })

  it('Shutdown test', async () => {
    const exitPromise = TestUtils.waitWorkerExits(pool, min)
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(numberOfExitEvents).toBe(min)
  })

  it('Validation of inputs test', () => {
    expect(() => new DynamicClusterPool(min)).toThrowError(
      'Please specify a file with a worker implementation'
    )
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/testWorker.js'
    )
    const result = await pool1.execute()
    expect(result).toBe(false)
    // We need to clean up the resources after our test
    await pool1.destroy()
  })

  it('Verify scale processes up and down is working when long executing task is used:hard', async () => {
    const longRunningPool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/longRunningWorkerHardBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.log('long executing worker is online'),
        exitHandler: () => console.log('long executing worker exited')
      }
    )
    expect(longRunningPool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 2; i++) {
      longRunningPool.execute()
    }
    expect(longRunningPool.workerNodes.length).toBe(max)
    await TestUtils.waitWorkerExits(longRunningPool, max - min)
    expect(longRunningPool.workerNodes.length).toBe(min)
    expect(
      longRunningPool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        longRunningPool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeId
    ).toBeLessThan(longRunningPool.workerNodes.length)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
  })

  it('Verify scale processes up and down is working when long executing task is used:soft', async () => {
    const longRunningPool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/longRunningWorkerSoftBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.log('long executing worker is online'),
        exitHandler: () => console.log('long executing worker exited')
      }
    )
    expect(longRunningPool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 2; i++) {
      longRunningPool.execute()
    }
    expect(longRunningPool.workerNodes.length).toBe(max)
    await TestUtils.sleep(1500)
    // Here we expect the workerNodes to be at the max size since the task is still executing
    expect(longRunningPool.workerNodes.length).toBe(max)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
  })

  it('Verify that a pool with zero worker can be instantiated', async () => {
    const pool = new DynamicClusterPool(
      0,
      max,
      './tests/worker-files/cluster/testWorker.js'
    )
    expect(pool).toBeInstanceOf(DynamicClusterPool)
    // We need to clean up the resources after our test
    await pool.destroy()
  })
})
