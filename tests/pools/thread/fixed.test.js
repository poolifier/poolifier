const expect = require('expect')
const { FixedThreadPool } = require('../../../lib/index')
const TestUtils = require('../../test-utils')
const numberOfThreads = 10
const pool = new FixedThreadPool(
  numberOfThreads,
  './tests/worker-files/thread/testWorker.js',
  {
    errorHandler: e => console.error(e)
  }
)
const emptyPool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/emptyWorker.js',
  { exitHandler: () => console.log('empty pool worker exited') }
)
const echoPool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/echoWorker.js'
)
const errorPool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/errorWorker.js',
  {
    errorHandler: e => console.error(e)
  }
)
const asyncErrorPool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/asyncErrorWorker.js',
  {
    errorHandler: e => console.error(e)
  }
)
const asyncPool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/asyncWorker.js'
)

describe('Fixed thread pool test suite', () => {
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
    for (let i = 0; i < numberOfThreads; i++) {
      results.add(pool.chooseWorker().threadId)
    }
    expect(results.size).toBe(numberOfThreads)
  })

  it('Verify that the function is executed in a worker thread', async () => {
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
    for (let i = 0; i < numberOfThreads * 2; i++) {
      promises.push(pool.execute({ test: 'test' }))
    }
    expect(poolBusy).toBe(numberOfThreads)
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
    expect(inError).toBeInstanceOf(Error)
    expect(inError.message).toBeDefined()
    expect(typeof inError.message === 'string').toBe(true)
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
    const exitPromise = TestUtils.waitExits(pool, numberOfThreads)
    await pool.destroy()
    const res = await exitPromise
    expect(res).toBe(numberOfThreads)
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new FixedThreadPool(
      1,
      './tests/worker-files/thread/testWorker.js'
    )
    const res = await pool1.execute({ test: 'test' })
    expect(res).toBeFalsy()
    // We need to clean up the resources after our test
    await pool1.destroy()
  })

  it('Verify that a pool with zero worker fails', async () => {
    expect(
      () => new FixedThreadPool(0, './tests/worker-files/thread/testWorker.js')
    ).toThrowError(new Error('Cannot instantiate a fixed pool with no worker'))
  })
})
