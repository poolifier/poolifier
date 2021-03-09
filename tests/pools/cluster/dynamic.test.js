const expect = require('expect')
const { DynamicClusterPool } = require('../../../lib/index')
const TestUtils = require('../../test-utils')
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

describe('Dynamic cluster pool test suite', () => {
  it('Verify that the function is executed in a worker cluster', async () => {
    const result = await pool.execute({ test: 'test' })
    expect(result).toBeDefined()
    expect(result).toBeFalsy()
  })

  it('Verify that new workers are created when required, max size is not exceeded and that after a while new workers will die', async () => {
    const promises = []
    let poolBusy = 0
    pool.emitter.on('busy', () => poolBusy++)
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute({ test: 'test' }))
    }
    expect(pool.workers.length).toBeLessThanOrEqual(max)
    expect(pool.workers.length).toBeGreaterThan(min)
    expect(poolBusy).toBe(max + 1)
    const numberOfExitEvents = await TestUtils.waitExits(pool, max - min)
    expect(numberOfExitEvents).toBe(max - min)
  })

  it('Verify scale worker up and down is working', async () => {
    expect(pool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      pool.execute({ test: 'test' })
    }
    expect(pool.workers.length).toBeGreaterThan(min)
    await TestUtils.waitExits(pool, max - min)
    expect(pool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      pool.execute({ test: 'test' })
    }
    expect(pool.workers.length).toBeGreaterThan(min)
    await TestUtils.waitExits(pool, max - min)
    expect(pool.workers.length).toBe(min)
  })

  it('Shutdown test', async () => {
    const exitPromise = TestUtils.waitExits(pool, min)
    await pool.destroy()
    const res = await exitPromise
    expect(res).toBe(min)
  })

  it('Validation of inputs test', () => {
    expect(() => new DynamicClusterPool(min)).toThrowError(
      new Error('Please specify a file with a worker implementation')
    )
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new DynamicClusterPool(
      1,
      1,
      './tests/worker-files/cluster/testWorker.js'
    )
    const result = await pool1.execute({ test: 'test' })
    expect(result).toBeDefined()
    expect(result).toBeFalsy()
    // We need to clean up the resources after our test
    await pool1.destroy()
  })

  it('Verify scale processes up and down is working when long running task is used:hard', async () => {
    const longRunningPool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/longRunningWorkerHardBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.log('long running worker is online'),
        exitHandler: () => console.log('long running worker exited')
      }
    )
    expect(longRunningPool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      longRunningPool.execute({ test: 'test' })
    }
    expect(longRunningPool.workers.length).toBe(max)
    await TestUtils.waitExits(longRunningPool, max - min)
    // Here we expect the workers to be at the max size since that the task is still running
    expect(longRunningPool.workers.length).toBe(min)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
  })

  it('Verify scale processes up and down is working when long running task is used:soft', async () => {
    const longRunningPool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/longRunningWorkerSoftBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.log('long running worker is online'),
        exitHandler: () => console.log('long running worker exited')
      }
    )
    expect(longRunningPool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      longRunningPool.execute({ test: 'test' })
    }
    expect(longRunningPool.workers.length).toBe(max)
    await TestUtils.sleep(1500)
    // Here we expect the workers to be at the max size since that the task is still running
    expect(longRunningPool.workers.length).toBe(max)
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
