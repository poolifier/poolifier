const expect = require('expect')
const { FixedThreadPool } = require('../../../lib/index')
const { FixedClusterPool } = require('../../../lib/index')
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

describe('Abstract pool test suite', () => {
  it('Simulate worker not found during increaseWorkersTask', () => {
    const pool = new StubPoolWithTasksMapClear(
      1,
      './tests/worker-files/thread/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.increaseWorkersTask()).toThrowError(expectedError)
  })

  it('Simulate worker not found during decreaseWorkersTasks', () => {
    const pool = new StubPoolWithTasksMapClear(
      1,
      './tests/worker-files/thread/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.decreaseWorkersTasks()).toThrowError(expectedError)
  })

  it('Simulate pool creation from a non main thread/process', () => {
    expect(() => {
      const pool = new StubPoolWithIsMainMethod(
        1,
        './tests/worker-files/thread/testWorker.js',
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

  it('Verify that numberOfWorkers is checked', () => {
    expect(() => {
      const pool = new FixedThreadPool(
        './tests/worker-files/thread/testWorker.js'
      ).toThrowError(
        new Error(
          'Cannot instantiate a pool without specifying the number of workers'
        )
      )
    })
  })

  it('Verify that a negative number of workers is checked', () => {
    expect(() => {
      const pool = new FixedClusterPool(
        -1,
        './tests/worker-files/cluster/testWorker.js'
      ).toThrowError(
        new Error('Cannot instantiate a pool with a negative number of workers')
      )
    })
  })

  it('Verify that a non integer number of workers is checked', () => {
    expect(() => {
      const pool = new FixedThreadPool(
        0.25,
        './tests/worker-files/thread/testWorker.js'
      ).toThrowError(
        new Error(
          'Cannot instantiate a pool with a non integer number of workers'
        )
      )
    })
  })
})
