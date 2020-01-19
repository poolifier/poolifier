const expect = require('expect')
const DynamicThreadPool = require('../lib/dynamic')
const min = 1
const max = 3
const pool = new DynamicThreadPool(min, max,
  './tests/testWorker.js',
  { errorHandler: (e) => console.error(e), onlineHandler: () => console.log('worker is online') })

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
    for (let i = 0; i < (max * 2); i++) {
      promises.push(pool.execute({ test: 'test' }))
    }
    expect(pool.workers.length).toBe(max)
    pool.workers.forEach(w => {
      w.on('exit', () => {
        closedThreads++
      })
    })
    expect(fullPool > 1).toBeTruthy()
    await new Promise(resolve => setTimeout(resolve, 2000))
    expect(closedThreads).toBe(max - min)
  })

  it('Shutdown test', async () => {
    let closedThreads = 0
    pool.workers.forEach(w => {
      w.on('exit', () => {
        closedThreads++
      })
    })
    pool.destroy()
    await new Promise(resolve => setTimeout(resolve, 2000))
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
    const pool1 = new DynamicThreadPool(1, 1, './tests/testWorker.js')
    const res = await pool1.execute({ test: 'test' })
    expect(res).toBeFalsy()
  })
})
