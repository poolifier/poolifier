const expect = require('expect')
const { FixedClusterPool, FixedThreadPool } = require('../../../lib/index')
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
      './tests/worker-files/thread/testWorker.js'
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.increaseWorkersTask()).toThrowError(expectedError)
    pool.destroy()
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
    pool.destroy()
  })

  it('Simulate pool creation from a non main thread/process', () => {
    expect(
      () =>
        new StubPoolWithIsMainMethod(
          1,
          './tests/worker-files/thread/testWorker.js',
          {
            errorHandler: e => console.error(e)
          }
        )
    ).toThrowError(new Error('Cannot start a pool from a worker!'))
  })

  it('Verify that filePath is checked', () => {
    expect(() => new FixedThreadPool(1)).toThrowError(
      new Error('Please specify a file with a worker implementation')
    )
    expect(() => new FixedThreadPool(1, '')).toThrowError(
      new Error('Please specify a file with a worker implementation')
    )
  })

  it('Verify that numberOfWorkers is checked', () => {
    expect(() => new FixedThreadPool()).toThrowError(
      new Error(
        'Cannot instantiate a pool without specifying the number of workers'
      )
    )
  })

  it('Verify that a negative number of workers is checked', () => {
    expect(
      () =>
        new FixedClusterPool(-1, './tests/worker-files/cluster/testWorker.js')
    ).toThrowError(
      new Error('Cannot instantiate a pool with a negative number of workers')
    )
  })

  it('Verify that a non integer number of workers is checked', () => {
    expect(
      () =>
        new FixedThreadPool(0.25, './tests/worker-files/thread/testWorker.js')
    ).toThrowError(
      new Error(
        'Cannot instantiate a pool with a non integer number of workers'
      )
    )
  })

  it('Verify that pool options are checked', () => {
    let pool = new FixedThreadPool(
      1,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(pool.opts.eventsEnabled).toEqual(true)
    pool.destroy()
    pool = new FixedThreadPool(1, './tests/worker-files/thread/testWorker.js', {
      eventsEnabled: false
    })
    expect(pool.opts.eventsEnabled).toEqual(false)
    expect(pool.emitter).toBeUndefined()
    pool.destroy()
  })
})
