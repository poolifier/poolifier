const expect = require('expect')
const { DynamicThreadPool } = require('../../../lib/index')
const TestUtils = require('../../test-utils')
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

describe('Dynamic thread pool test suite ', () => {
  it('Verify that the function is executed in a worker thread', async () => {
    const result = await pool.execute({ test: 'test' })
    expect(result).toBeDefined()
    expect(result).toBeFalsy()
  })

  it('Verify that new workers are created when required, max size is not exceeded and that after a while new workers will die', async () => {
    const promises = []
    let closedThreads = 0
    let fullPool = 0
    pool.emitter.on('FullPool', () => fullPool++)
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute({ test: 'test' }))
    }
    expect(pool.workers.length).toBe(max)
    pool.workers.forEach(w => {
      w.on('exit', () => {
        closedThreads++
      })
    })
    expect(fullPool > 1).toBeTruthy()
    await TestUtils.sleep(2000)
    expect(closedThreads).toBe(max - min)
  })

  it('Verify scale thread up and down is working', async () => {
    expect(pool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      pool.execute({ test: 'test' })
    }
    expect(pool.workers.length).toBe(max)
    await TestUtils.sleep(1000)
    expect(pool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      pool.execute({ test: 'test' })
    }
    expect(pool.workers.length).toBe(max)
    await TestUtils.sleep(1500)
    expect(pool.workers.length).toBe(min)
  })

  it('Shutdown test', async () => {
    let closedThreads = 0
    pool.workers.forEach(w => {
      w.on('exit', () => {
        closedThreads++
      })
    })
    await pool.destroy()
    expect(closedThreads).toBe(min)
  })

  it('Validations test', () => {
    let error
    try {
      const pool1 = new DynamicThreadPool()
      console.log(pool1)
    } catch (e) {
      error = e
    }
    expect(error).toBeTruthy()
    expect(error.message).toBeTruthy()
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new DynamicThreadPool(
      1,
      1,
      './tests/worker-files/thread/testWorker.js'
    )
    const res = await pool1.execute({ test: 'test' })
    expect(res).toBeFalsy()
  })

  it('Verify scale thread up and down is working when long running task is used:hard', async () => {
    const longRunningPool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/longRunningWorkerHardBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.log('worker is online')
      }
    )
    expect(longRunningPool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      longRunningPool.execute({ test: 'test' })
    }
    expect(longRunningPool.workers.length).toBe(max)
    await TestUtils.sleep(1500)
    expect(longRunningPool.workers.length).toBe(min)
  })

  it('Verify scale thread up and down is working when long running task is used:soft', async () => {
    const longRunningPool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/longRunningWorkerSoftBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.log('worker is online')
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
  })
})
