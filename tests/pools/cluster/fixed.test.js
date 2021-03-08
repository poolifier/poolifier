const expect = require('expect')
const { FixedClusterPool } = require('../../../lib/index')
const TestUtils = require('../../test-utils')
const numberOfWorkers = 10
const pool = new FixedClusterPool(
  numberOfWorkers,
  './tests/worker-files/cluster/testWorker.js',
  {
    errorHandler: e => console.error(e)
  }
)
const emptyPool = new FixedClusterPool(
  1,
  './tests/worker-files/cluster/emptyWorker.js',
  { exitHandler: () => console.log('empty pool worker exited') }
)
const echoPool = new FixedClusterPool(
  1,
  './tests/worker-files/cluster/echoWorker.js'
)
const errorPool = new FixedClusterPool(
  1,
  './tests/worker-files/cluster/errorWorker.js',
  {
    errorHandler: e => console.error(e)
  }
)
const asyncErrorPool = new FixedClusterPool(
  1,
  './tests/worker-files/cluster/asyncErrorWorker.js',
  {
    errorHandler: e => console.error(e)
  }
)
const asyncPool = new FixedClusterPool(
  1,
  './tests/worker-files/cluster/asyncWorker.js'
)

describe('Fixed cluster pool test suite', () => {
  after('Destroy all pools', async () => {
    // We need to clean up the resources after our test
    await echoPool.destroy()
    await asyncPool.destroy()
    await errorPool.destroy()
    await asyncErrorPool.destroy()
    await emptyPool.destroy()
  })

  it('Choose worker round robin test', async () => {
    const results = new Set()
    for (let i = 0; i < numberOfWorkers; i++) {
      results.add(pool.chooseWorker().id)
    }
    expect(results.size).toBe(numberOfWorkers)
  })

  it('Verify that the function is executed in a worker cluster', async () => {
    const result = await pool.execute({ test: 'test' })
    expect(result).toBeDefined()
    expect(result).toBeFalsy()
  })

  it('Verify that is possible to invoke the execute method without input', async () => {
    const result = await pool.execute()
    expect(result).toBeDefined()
    expect(result).toBeFalsy()
  })

  it('Verify that busy event is emitted', async () => {
    const promises = []
    let poolBusy = 0
    pool.emitter.on('busy', () => poolBusy++)
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.push(pool.execute({ test: 'test' }))
    }
    expect(poolBusy).toBe(numberOfWorkers)
  })

  it('Verify that is possible to have a worker that return undefined', async () => {
    const result = await emptyPool.execute()
    expect(result).toBeFalsy()
  })

  it('Verify that data are sent to the worker correctly', async () => {
    const data = { f: 10 }
    const result = await echoPool.execute(data)
    expect(result).toBeTruthy()
    expect(result.f).toBe(data.f)
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
    expect(typeof inError === 'string').toBe(true)
    expect(inError).toBe('Error Message from ClusterWorker')
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
    expect(typeof inError === 'string').toBe(true)
    expect(inError).toBe('Error Message from ClusterWorker:async')
  })

  it('Verify that async function is working properly', async () => {
    const data = { f: 10 }
    const startTime = new Date().getTime()
    const result = await asyncPool.execute(data)
    const usedTime = new Date().getTime() - startTime
    expect(result).toBeTruthy()
    expect(result.f).toBe(data.f)
    expect(usedTime).toBeGreaterThanOrEqual(2000)
  })

  it('Shutdown test', async () => {
    const exitPromise = TestUtils.waitExits(pool, numberOfWorkers)
    await pool.destroy()
    const res = await exitPromise
    expect(res).toBe(numberOfWorkers)
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new FixedClusterPool(
      1,
      './tests/worker-files/cluster/testWorker.js'
    )
    const res = await pool1.execute({ test: 'test' })
    expect(res).toBeFalsy()
    // We need to clean up the resources after our test
    await pool1.destroy()
  })

  it('Verify that a pool with zero worker fails', async () => {
    expect(
      () =>
        new FixedClusterPool(0, './tests/worker-files/cluster/testWorker.js')
    ).toThrowError(new Error('Cannot instantiate a fixed pool with no worker'))
  })
})
