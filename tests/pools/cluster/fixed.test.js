const { expect } = require('expect')
const { FixedClusterPool } = require('../../../lib/index')
const WorkerFunctions = require('../../test-types')
const TestUtils = require('../../test-utils')

describe('Fixed cluster pool test suite', () => {
  const numberOfWorkers = 6
  const pool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/testWorker.js',
    {
      errorHandler: e => console.error(e)
    }
  )
  const emptyPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/emptyWorker.js',
    { exitHandler: () => console.log('empty pool worker exited') }
  )
  const echoPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/echoWorker.js'
  )
  const errorPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/errorWorker.js',
    {
      errorHandler: e => console.error(e)
    }
  )
  const asyncErrorPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/asyncErrorWorker.js',
    {
      errorHandler: e => console.error(e)
    }
  )
  const asyncPool = new FixedClusterPool(
    numberOfWorkers,
    './tests/worker-files/cluster/asyncWorker.js'
  )

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
    let result = await pool.execute({
      function: WorkerFunctions.fibonacci
    })
    expect(result).toBe(false)
    result = await pool.execute({
      function: WorkerFunctions.factorial
    })
    expect(result).toBe(false)
  })

  it('Verify that is possible to invoke the execute method without input', async () => {
    const result = await pool.execute()
    expect(result).toBe(false)
  })

  it('Verify that busy event is emitted', async () => {
    const promises = []
    let poolBusy = 0
    pool.emitter.on('busy', () => poolBusy++)
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.push(pool.execute())
    }
    // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
    // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the fixed pool.
    expect(poolBusy).toBe(numberOfWorkers + 1)
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
    expect(result).toStrictEqual(data)
    expect(usedTime).toBeGreaterThanOrEqual(2000)
  })

  it('Shutdown test', async () => {
    const exitPromise = TestUtils.waitExits(pool, numberOfWorkers)
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(numberOfExitEvents).toBe(numberOfWorkers)
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    const res = await pool1.execute()
    expect(res).toBe(false)
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
