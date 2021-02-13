const expect = require('expect')
const { FixedClusterPool } = require('../../../lib/index')
const numberOfWorkers = 10
const maxTasks = 500
const pool = new FixedClusterPool(
  numberOfWorkers,
  './tests/worker/cluster/testWorker.js',
  {
    errorHandler: e => console.error(e),
    onlineHandler: () => console.log('worker is online')
  }
)
const emptyPool = new FixedClusterPool(
  1,
  './tests/worker/cluster/emptyWorker.js'
)
const echoPool = new FixedClusterPool(1, './tests/worker/cluster/echoWorker.js')
const errorPool = new FixedClusterPool(
  1,
  './tests/worker/cluster/errorWorker.js',
  {
    errorHandler: e => console.error(e),
    onlineHandler: () => console.log('worker is online')
  }
)

const asyncErrorPool = new FixedClusterPool(
  1,
  './tests/worker/cluster/asyncErrorWorker.js',
  {
    onlineHandler: () => console.log('worker is online')
  }
)
const asyncPool = new FixedClusterPool(
  1,
  './tests/worker/cluster/asyncWorker.js',
  {
    maxTasks: maxTasks
  }
)

describe('Fixed cluster pool test suite ', () => {
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
    expect(typeof inError === 'string').toBeTruthy()
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
    expect(typeof inError === 'string').toBeTruthy()
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

  it('Verify that maxTasks is set properly', async () => {
    const worker = asyncPool.chooseWorker()
    expect(worker.getMaxListeners()).toBe(maxTasks)
  })

  it('Shutdown test', async () => {
    let closedWorkers = 0
    console.log('FixedClusterPool workers length', pool.workers.length)
    pool.workers.forEach(w => {
      w.on('exit', () => {
        console.log('Remove cluster worker', closedWorkers)
        closedWorkers++
      })
    })
    await pool.destroy()
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(closedWorkers).toBe(numberOfWorkers)
  })

  it('Validations test', () => {
    let error
    try {
      const pool1 = new FixedClusterPool()
      console.log(pool1)
    } catch (e) {
      error = e
    }
    expect(error).toBeTruthy()
    expect(error.message).toBeTruthy()
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new FixedClusterPool(
      1,
      './tests/worker/cluster/testWorker.js'
    )
    const res = await pool1.execute({ test: 'test' })
    expect(res).toBeFalsy()
  })
})
