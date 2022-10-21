const { expect } = require('expect')
const {
  FixedClusterPool,
  // DynamicThreadPool,
  FixedThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')

describe('Abstract pool test suite', () => {
  const numberOfWorkers = 1
  const workerNotFoundInTasksUsageMapError = new Error(
    'Worker could not be found in workers tasks usage map'
  )
  class StubPoolWithWorkerTasksUsageMapClear extends FixedThreadPool {
    removeAllWorker () {
      this.workers.length = 0
      // this.workersTasksUsage.clear()
    }
  }
  class StubPoolWithIsMainMethod extends FixedThreadPool {
    isMain () {
      return false
    }
  }

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

  it('Verify that pool options are checked', async () => {
    let pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(pool.opts.enableEvents).toBe(true)
    expect(pool.emitter).toBeDefined()
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(pool.opts.messageHandler).toBeUndefined()
    expect(pool.opts.errorHandler).toBeUndefined()
    expect(pool.opts.onlineHandler).toBeUndefined()
    expect(pool.opts.exitHandler).toBeUndefined()
    await pool.destroy()
    const testHandler = () => console.log('test handler executed')
    pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js',
      {
        workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED,
        enableEvents: false,
        messageHandler: testHandler,
        errorHandler: testHandler,
        onlineHandler: testHandler,
        exitHandler: testHandler
      }
    )
    expect(pool.opts.enableEvents).toBe(false)
    expect(pool.emitter).toBeUndefined()
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )
    expect(pool.opts.messageHandler).toStrictEqual(testHandler)
    expect(pool.opts.errorHandler).toStrictEqual(testHandler)
    expect(pool.opts.onlineHandler).toStrictEqual(testHandler)
    expect(pool.opts.exitHandler).toStrictEqual(testHandler)
    await pool.destroy()
  })

  it('Simulate worker not found during increaseWorkerRunningTasks', async () => {
    const pool = new StubPoolWithWorkerTasksUsageMapClear(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.increaseWorkerRunningTasks()).toThrowError(
      workerNotFoundInTasksUsageMapError
    )
    await pool.destroy()
  })

  it('Simulate worker not found during decreaseWorkerRunningTasks', async () => {
    const pool = new StubPoolWithWorkerTasksUsageMapClear(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.decreaseWorkerRunningTasks()).toThrowError(
      workerNotFoundInTasksUsageMapError
    )
    await pool.destroy()
  })

  it('Simulate worker not found during stepWorkerRunTasks', async () => {
    const pool = new StubPoolWithWorkerTasksUsageMapClear(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.stepWorkerRunTasks()).toThrowError(
      workerNotFoundInTasksUsageMapError
    )
    await pool.destroy()
  })

  it('Simulate worker not found during updateWorkerTasksRunTime with strategy not requiring it', async () => {
    const pool = new StubPoolWithWorkerTasksUsageMapClear(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.updateWorkerTasksRunTime()).not.toThrowError()
    await pool.destroy()
  })

  it('Simulate worker not found during updateWorkerTasksRunTime with strategy requiring it', async () => {
    const pool = new StubPoolWithWorkerTasksUsageMapClear(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js',
      {
        workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE,
        errorHandler: e => console.error(e)
      }
    )
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(() => pool.updateWorkerTasksRunTime()).toThrowError(
      workerNotFoundInTasksUsageMapError
    )
    await pool.destroy()
  })

  // it('Verify that worker pool tasks usage are initialized', async () => {
  //   const pool = new FixedClusterPool(
  //     numberOfWorkers,
  //     './tests/worker-files/cluster/testWorker.js'
  //   )
  //   for (const tasksUsage of pool.workersTasksUsage.values()) {
  //     expect(tasksUsage).toBeDefined()
  //     expect(tasksUsage.run).toBe(0)
  //     expect(tasksUsage.running).toBe(0)
  //     expect(tasksUsage.runTime).toBe(0)
  //     expect(tasksUsage.avgRunTime).toBe(0)
  //   }
  //   await pool.destroy()
  // })

  // it('Verify that worker pool tasks usage are computed', async () => {
  //   const pool = new FixedClusterPool(
  //     numberOfWorkers,
  //     './tests/worker-files/cluster/testWorker.js'
  //   )
  //   const promises = []
  //   for (let i = 0; i < numberOfWorkers * 2; i++) {
  //     promises.push(pool.execute())
  //   }
  //   for (const tasksUsage of pool.workersTasksUsage.values()) {
  //     expect(tasksUsage).toBeDefined()
  //     expect(tasksUsage.run).toBe(0)
  //     expect(tasksUsage.running).toBe(numberOfWorkers * 2)
  //     expect(tasksUsage.runTime).toBe(0)
  //     expect(tasksUsage.avgRunTime).toBe(0)
  //   }
  //   await Promise.all(promises)
  //   for (const tasksUsage of pool.workersTasksUsage.values()) {
  //     expect(tasksUsage).toBeDefined()
  //     expect(tasksUsage.run).toBe(numberOfWorkers * 2)
  //     expect(tasksUsage.running).toBe(0)
  //     expect(tasksUsage.runTime).toBeGreaterThanOrEqual(0)
  //     expect(tasksUsage.avgRunTime).toBeGreaterThanOrEqual(0)
  //   }
  //   await pool.destroy()
  // })

  // it('Verify that worker pool tasks usage are reset at worker choice strategy change', async () => {
  //   const pool = new DynamicThreadPool(
  //     numberOfWorkers,
  //     numberOfWorkers,
  //     './tests/worker-files/thread/testWorker.js'
  //   )
  //   const promises = []
  //   for (let i = 0; i < numberOfWorkers * 2; i++) {
  //     promises.push(pool.execute())
  //   }
  //   await Promise.all(promises)
  //   for (const tasksUsage of pool.workersTasksUsage.values()) {
  //     expect(tasksUsage).toBeDefined()
  //     expect(tasksUsage.run).toBe(numberOfWorkers * 2)
  //     expect(tasksUsage.running).toBe(0)
  //     expect(tasksUsage.runTime).toBeGreaterThanOrEqual(0)
  //     expect(tasksUsage.avgRunTime).toBeGreaterThanOrEqual(0)
  //   }
  //   pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
  //   for (const tasksUsage of pool.workersTasksUsage.values()) {
  //     expect(tasksUsage).toBeDefined()
  //     expect(tasksUsage.run).toBe(0)
  //     expect(tasksUsage.running).toBe(0)
  //     expect(tasksUsage.runTime).toBe(0)
  //     expect(tasksUsage.avgRunTime).toBe(0)
  //   }
  //   await pool.destroy()
  // })

  it("Verify that pool event emitter 'busy' event can register a callback", async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    const promises = []
    let poolBusy = 0
    pool.emitter.on('busy', () => poolBusy++)
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
    // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the fixed pool.
    expect(poolBusy).toBe(numberOfWorkers + 1)
    await pool.destroy()
  })
})
