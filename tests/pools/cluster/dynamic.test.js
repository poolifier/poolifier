const expect = require('expect')
const { DynamicClusterPool } = require('../../../lib/index')
const min = 1
const max = 3
const pool = new DynamicClusterPool(
  min,
  max,
  './tests/worker/cluster/testWorker.js',
  {
    errorHandler: e => console.error(e)
  }
)

describe('Dynamic cluster pool test suite ', () => {
  it('Verify that the function is executed in a worker cluster', async () => {
    const result = await pool.execute({ test: 'test' })
    expect(result).toBeDefined()
    expect(result).toBeFalsy()
  })

  it('Verify that new workers are created when required, max size is not exceeded and that after a while new workers will die', async () => {
    const promises = []
    let closedWorkers = 0
    let fullPool = 0
    pool.emitter.on('FullPool', () => fullPool++)
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute({ test: 'test' }))
    }
    expect(pool.workers.length).toBeLessThanOrEqual(max)
    expect(pool.workers.length).toBeGreaterThan(min)
    pool.workers.forEach(w => {
      w.on('exit', () => {
        closedWorkers++
      })
    })
    expect(fullPool > 1).toBeTruthy()
    await new Promise(resolve => setTimeout(resolve, 5000))
    expect(closedWorkers).toBe(max - min)
  })

  it('Verify scale worker up and down is working', async () => {
    expect(pool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      pool.execute({ test: 'test' })
    }
    expect(pool.workers.length).toBeGreaterThan(min)
    await new Promise(resolve => setTimeout(resolve, 3000))
    expect(pool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      pool.execute({ test: 'test' })
    }
    expect(pool.workers.length).toBeGreaterThan(min)
    await new Promise(resolve => setTimeout(resolve, 3000))
    expect(pool.workers.length).toBe(min)
  })
  it('Shutdown test', async () => {
    let closedWorkers = 0
    pool.workers.forEach(w => {
      w.on('exit', () => {
        closedWorkers++
      })
    })
    pool.destroy()
    await new Promise(resolve => setTimeout(resolve, 2000))
    expect(closedWorkers).toBe(min)
  })

  it('Validations test', () => {
    let error
    try {
      const pool1 = new DynamicClusterPool()
      console.log(pool1)
    } catch (e) {
      error = e
    }
    expect(error).toBeTruthy()
    expect(error.message).toBeTruthy()
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new DynamicClusterPool(
      1,
      1,
      './tests/worker/cluster/testWorker.js'
    )
    const res = await pool1.execute({ test: 'test' })
    expect(res).toBeFalsy()
  })
  it('Verify scale processes up and down is working when long running task is used', async () => {
    const longRunningPool = new DynamicClusterPool(
      min,
      max,
      './tests/worker/cluster/longRunningWorker.js'
    )
    expect(longRunningPool.workers.length).toBe(min)
    for (let i = 0; i < max * 10; i++) {
      longRunningPool.execute({ test: 'test' })
    }
    expect(longRunningPool.workers.length).toBe(max)
    await new Promise(resolve => setTimeout(resolve, 3000))
    // Here we expect the workers to be at the max size since that the task is still running
    expect(longRunningPool.workers.length).toBe(max)
  })
})
