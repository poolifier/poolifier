const expect = require('expect')
const { FixedThreadPool } = require('../../../lib/index')
const { waitExits } = require('../../test-util-functions')
const numberOfThreads = 10
const maxTasks = 400
const pool = new FixedThreadPool(
  numberOfThreads,
  './tests/worker-files/thread/testWorker.js',
  {
    errorHandler: e => console.error(e)
  }
)
const emptyPool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/emptyWorker.js'
)
const echoPool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/echoWorker.js'
)
const errorPool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/errorWorker.js',
  {
    errorHandler: e => console.error(e),
    onlineHandler: () => console.log('worker is online')
  }
)
const asyncPool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/asyncWorker.js',
  { maxTasks: maxTasks }
)

describe('Fixed thread pool test suite ', () => {
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

  it('Verify that error handling is working properly', async () => {
    const data = { f: 10 }
    let inError
    try {
      await errorPool.execute(data)
    } catch (e) {
      inError = e
    }
    expect(inError).toBeTruthy()
    expect(inError instanceof Error).toBeTruthy()
    expect(inError.message).toBeTruthy()
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

  it('Verify that maxTasks is set properly', async () => {
    const worker = asyncPool.chooseWorker()
    expect(worker.port2.getMaxListeners()).toBe(maxTasks)
  })

  it('Shutdown test', async () => {
    const exitPromise = waitExits(pool, numberOfThreads)
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
  })
})
