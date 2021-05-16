const expect = require('expect')
const {
  FixedClusterPool,
  FixedThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const expectedError = new Error(
  'Worker could not be found in worker tasks usage map'
)

const numberOfWorkers = 1

class StubPoolWithWorkerTasksUsageMapClear extends FixedThreadPool {
  removeAllWorker () {
    this.workerTasksUsage.clear()
  }
}

class StubPoolWithIsMainMethod extends FixedThreadPool {
  isMain () {
    return false
  }
}

describe('Abstract pool test suite', () => {
  it('Simulate worker not found during increaseWorkerRunningTasks', () => {
    const pool = new StubPoolWithWorkerTasksUsageMapClear(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.increaseWorkerRunningTasks()).toThrowError(expectedError)
    pool.destroy()
  })

  it('Simulate worker not found during decreaseWorkerRunningTasks', () => {
    const pool = new StubPoolWithWorkerTasksUsageMapClear(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.decreaseWorkerRunningTasks()).toThrowError(expectedError)
    pool.destroy()
  })

  it('Simulate worker not found during stepWorkerRunTasks', () => {
    const pool = new StubPoolWithWorkerTasksUsageMapClear(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.stepWorkerRunTasks()).toThrowError(expectedError)
    pool.destroy()
  })

  it('Simulate worker not found during computeWorkerTasksRunTime', () => {
    const pool = new StubPoolWithWorkerTasksUsageMapClear(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.computeWorkerTasksRunTime()).toThrowError(expectedError)
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
    // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
    // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the fixed pool.
    expect(poolBusy).toBe(numberOfWorkers + 1)
    pool.destroy()
  })

  it('Verify that worker pool tasks usage are initialized', () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    for (const tasksUsage of pool.workerTasksUsage.values()) {
      expect(tasksUsage).toBeDefined()
      expect(tasksUsage.run).toBe(0)
      expect(tasksUsage.running).toBe(0)
      expect(tasksUsage.runTime).toBe(0)
      expect(tasksUsage.avgRunTime).toBe(0)
    }
    pool.destroy()
  })

  it('Verify that worker pool tasks usage are computed', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    const promises = []
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.push(pool.execute({ test: 'test' }))
    }
    for (const tasksUsage of pool.workerTasksUsage.values()) {
      expect(tasksUsage).toBeDefined()
      expect(tasksUsage.run).toBe(0)
      expect(tasksUsage.running).toBe(numberOfWorkers * 2)
      expect(tasksUsage.runTime).toBe(0)
      expect(tasksUsage.avgRunTime).toBe(0)
    }
    await Promise.all(promises)
    for (const tasksUsage of pool.workerTasksUsage.values()) {
      expect(tasksUsage).toBeDefined()
      expect(tasksUsage.run).toBe(numberOfWorkers * 2)
      expect(tasksUsage.running).toBe(0)
      expect(tasksUsage.runTime).toBeGreaterThan(0)
      expect(tasksUsage.avgRunTime).toBeGreaterThan(0)
    }
    pool.destroy()
  })
})
