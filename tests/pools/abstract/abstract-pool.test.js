const expect = require('expect')
const { FixedThreadPool } = require('../../../lib/index')
const expectedError = new Error('Worker could not be found in tasks map')

class StubPoolWithTasksMapClear extends FixedThreadPool {
  removeAllWorker () {
    this.tasks.clear()
  }
}

class StubPoolWithIsMainMethod extends FixedThreadPool {
  isMain () {
    return false
  }
}

describe('Abstract pool test suite ', () => {
  it('Simulate worker not found during increaseWorkersTask', () => {
    const pool = new StubPoolWithTasksMapClear(
      1,
      './tests/worker-files/cluster/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.increaseWorkersTask()).toThrowError(expectedError)
  })

  it('Simulate worker not found during decreaseWorkersTasks', () => {
    const pool = new StubPoolWithTasksMapClear(
      1,
      './tests/worker-files/cluster/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.decreaseWorkersTasks()).toThrowError(expectedError)
  })

  it('Simulate pool creation from a non main thread/process', () => {
    expect(() => {
      const pool = new StubPoolWithIsMainMethod(
        1,
        './tests/worker-files/cluster/testWorker.js',
        {
          errorHandler: e => console.error(e)
        }
      )
    }).toThrowError()
  })

  it('Verify that filePath is checked', () => {
    expect(() => {
      const pool = new StubPoolWithIsMainMethod(1).toThrowError()
    })
    expect(() => {
      const pool = new StubPoolWithIsMainMethod(1, '').toThrowError()
    })
  })
})
