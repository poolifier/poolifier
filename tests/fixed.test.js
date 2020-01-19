const expect = require('expect')
const FixedThreadPool = require('../lib/fixed')
const numThreads = 10
const pool = new FixedThreadPool(numThreads,
  './tests/testWorker.js',
  { errorHandler: (e) => console.error(e), onlineHandler: () => console.log('worker is online') })

describe('Fixed thread pool test suite ', () => {
  it('Choose worker round robin test', async () => {
    const results = new Set()
    for (let i = 0; i < numThreads; i++) {
      results.add(pool._chooseWorker().threadId)
    }
    expect(results.size).toBe(numThreads)
  })

  it('Verify that the function is executed in a worker thread', async () => {
    const result = await pool.execute({ test: 'test' })
    expect(result).toBeDefined()
    expect(result).toBeFalsy()
  })

  it('Shutdown test', async () => {
    let closedThreads = 0
    pool.workers.forEach(w => {
      w.on('exit', () => {
        closedThreads++
      })
    })
    pool.destroy()
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(closedThreads).toBe(numThreads)
  })

  it('Validations test', () => {
    let error
    try {
      const pool1 = new FixedThreadPool()
      console.log(pool1)
    } catch (e) {
      error = e
    }
    expect(error).toBeTruthy()
    expect(error.message).toBeTruthy()
  })

  it('Should work even without opts in input', async () => {
    const pool1 = new FixedThreadPool(1, './tests/testWorker.js')
    const res = await pool1.execute({ test: 'test' })
    expect(res).toBeFalsy()
  })
})
