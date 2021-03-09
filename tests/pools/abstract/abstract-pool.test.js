const expect = require('expect')
const {
  FixedClusterPool,
  FixedThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const expectedError = new Error('Worker could not be found in tasks map')

const numberOfWorkers = 1

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
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.increaseWorkersTask()).toThrowError(expectedError)
    pool.destroy()
  })

  it('Simulate worker not found during decreaseWorkersTasks', () => {
    const pool = new StubPoolWithTasksMapClear(
      numberOfWorkers,
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
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.js',
          {
            errorHandler: e => console.error(e)
          }
        )
    ).toThrowError(new Error('Cannot start a pool from a worker!'))
  })

  it('Verify that filePath is checked', () => {
    const expectedError = new Error(
      'Please specify a file with a worker implementation'
    )
    expect(() => new FixedThreadPool(numberOfWorkers)).toThrowError(
      expectedError
    )
    expect(() => new FixedThreadPool(numberOfWorkers, '')).toThrowError(
      expectedError
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
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(pool.opts.enableEvents).toBe(true)
    expect(pool.emitter).toBeDefined()
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    pool.destroy()
    pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js',
      {
        workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED,
        enableEvents: false
      }
    )
    expect(pool.opts.enableEvents).toBe(false)
    expect(pool.emitter).toBeUndefined()
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )
    pool.destroy()
  })

  it("Verify that pool event emitter 'busy' event can register a callback", () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    const promises = []
    let poolBusy = 0
    pool.emitter.on('busy', () => poolBusy++)
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.push(pool.execute({ test: 'test' }))
    }
    expect(poolBusy).toBe(numberOfWorkers)
    pool.destroy()
  })
})
