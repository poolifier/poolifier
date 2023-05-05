const { expect } = require('expect')
const {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  WorkerChoiceStrategies
} = require('../../../lib')
const { CircularArray } = require('../../../lib/circular-array')
const { Queue } = require('../../../lib/queue')

describe('Abstract pool test suite', () => {
  const numberOfWorkers = 1
  const workerNotFoundInPoolError = new Error(
    'Worker could not be found in the pool worker nodes'
  )
  class StubPoolWithRemoveAllWorker extends FixedThreadPool {
    removeAllWorker () {
      this.workerNodes = []
      this.promiseResponseMap.clear()
    }
  }
  class StubPoolWithIsMain extends FixedThreadPool {
    isMain () {
      return false
    }
  }

  it('Simulate pool creation from a non main thread/process', () => {
    expect(
      () =>
        new StubPoolWithIsMain(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.js',
          {
            errorHandler: e => console.error(e)
          }
        )
    ).toThrowError('Cannot start a pool from a worker!')
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
      'Cannot instantiate a pool without specifying the number of workers'
    )
  })

  it('Verify that a negative number of workers is checked', () => {
    expect(
      () =>
        new FixedClusterPool(-1, './tests/worker-files/cluster/testWorker.js')
    ).toThrowError(
      new RangeError(
        'Cannot instantiate a pool with a negative number of workers'
      )
    )
  })

  it('Verify that a non integer number of workers is checked', () => {
    expect(
      () =>
        new FixedThreadPool(0.25, './tests/worker-files/thread/testWorker.js')
    ).toThrowError(
      new TypeError(
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
    expect(pool.opts.enableTasksQueue).toBe(false)
    expect(pool.opts.tasksQueueOptions).toBeUndefined()
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      medRunTime: false
    })
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
        workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED,
        workerChoiceStrategyOptions: { medRunTime: true },
        enableEvents: false,
        enableTasksQueue: true,
        tasksQueueOptions: { concurrency: 2 },
        messageHandler: testHandler,
        errorHandler: testHandler,
        onlineHandler: testHandler,
        exitHandler: testHandler
      }
    )
    expect(pool.opts.enableEvents).toBe(false)
    expect(pool.emitter).toBeUndefined()
    expect(pool.opts.enableTasksQueue).toBe(true)
    expect(pool.opts.tasksQueueOptions).toStrictEqual({ concurrency: 2 })
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_USED
    )
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      medRunTime: true
    })
    expect(pool.opts.messageHandler).toStrictEqual(testHandler)
    expect(pool.opts.errorHandler).toStrictEqual(testHandler)
    expect(pool.opts.onlineHandler).toStrictEqual(testHandler)
    expect(pool.opts.exitHandler).toStrictEqual(testHandler)
    await pool.destroy()
  })

  it('Verify that pool options are validated', async () => {
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.js',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { concurrency: 0 }
          }
        )
    ).toThrowError("Invalid worker tasks concurrency '0'")
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.js',
          {
            workerChoiceStrategy: 'invalidStrategy'
          }
        )
    ).toThrowError("Invalid worker choice strategy 'invalidStrategy'")
  })

  it('Verify that worker choice strategy options can be set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
    )
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      medRunTime: false
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({ medRunTime: false })
    }
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
    pool.setWorkerChoiceStrategyOptions({ medRunTime: true })
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      medRunTime: true
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({ medRunTime: true })
    }
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(true)
    pool.setWorkerChoiceStrategyOptions({ medRunTime: false })
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      medRunTime: false
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({ medRunTime: false })
    }
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
    await pool.destroy()
  })

  it('Verify that tasks queue can be enabled/disabled', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(pool.opts.enableTasksQueue).toBe(false)
    expect(pool.opts.tasksQueueOptions).toBeUndefined()
    pool.enableTasksQueue(true)
    expect(pool.opts.enableTasksQueue).toBe(true)
    expect(pool.opts.tasksQueueOptions).toStrictEqual({ concurrency: 1 })
    pool.enableTasksQueue(true, { concurrency: 2 })
    expect(pool.opts.enableTasksQueue).toBe(true)
    expect(pool.opts.tasksQueueOptions).toStrictEqual({ concurrency: 2 })
    pool.enableTasksQueue(false)
    expect(pool.opts.enableTasksQueue).toBe(false)
    expect(pool.opts.tasksQueueOptions).toBeUndefined()
    await pool.destroy()
  })

  it('Verify that tasks queue options can be set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js',
      { enableTasksQueue: true }
    )
    expect(pool.opts.tasksQueueOptions).toStrictEqual({ concurrency: 1 })
    pool.setTasksQueueOptions({ concurrency: 2 })
    expect(pool.opts.tasksQueueOptions).toStrictEqual({ concurrency: 2 })
    expect(() => pool.setTasksQueueOptions({ concurrency: 0 })).toThrowError(
      "Invalid worker tasks concurrency '0'"
    )
    await pool.destroy()
  })

  it('Simulate worker not found at getWorkerTasksUsage()', async () => {
    const pool = new StubPoolWithRemoveAllWorker(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js',
      {
        errorHandler: e => console.error(e)
      }
    )
    expect(pool.workerNodes.length).toBe(numberOfWorkers)
    // Simulate worker not found.
    pool.removeAllWorker()
    expect(pool.workerNodes.length).toBe(0)
    expect(() => pool.getWorkerTasksUsage()).toThrowError(
      workerNotFoundInPoolError
    )
    await pool.destroy()
  })

  it('Verify that worker pool tasks usage are initialized', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toBeDefined()
      expect(workerNode.tasksUsage.run).toBe(0)
      expect(workerNode.tasksUsage.running).toBe(0)
      expect(workerNode.tasksUsage.runTime).toBe(0)
      expect(workerNode.tasksUsage.runTimeHistory).toBeInstanceOf(CircularArray)
      expect(workerNode.tasksUsage.runTimeHistory.length).toBe(0)
      expect(workerNode.tasksUsage.avgRunTime).toBe(0)
      expect(workerNode.tasksUsage.medRunTime).toBe(0)
      expect(workerNode.tasksUsage.error).toBe(0)
    }
    await pool.destroy()
  })

  it('Verify that worker pool tasks queue are initialized', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueue).toBeDefined()
      expect(workerNode.tasksQueue).toBeInstanceOf(Queue)
      expect(workerNode.tasksQueue.size).toBe(0)
    }
    await pool.destroy()
  })

  it('Verify that worker pool tasks usage are computed', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    const promises = []
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.push(pool.execute())
    }
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toBeDefined()
      expect(workerNode.tasksUsage.run).toBe(0)
      expect(workerNode.tasksUsage.running).toBe(numberOfWorkers * 2)
      expect(workerNode.tasksUsage.runTime).toBe(0)
      expect(workerNode.tasksUsage.runTimeHistory).toBeInstanceOf(CircularArray)
      expect(workerNode.tasksUsage.runTimeHistory.length).toBe(0)
      expect(workerNode.tasksUsage.avgRunTime).toBe(0)
      expect(workerNode.tasksUsage.medRunTime).toBe(0)
      expect(workerNode.tasksUsage.error).toBe(0)
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toBeDefined()
      expect(workerNode.tasksUsage.run).toBe(numberOfWorkers * 2)
      expect(workerNode.tasksUsage.running).toBe(0)
      expect(workerNode.tasksUsage.runTime).toBeGreaterThanOrEqual(0)
      expect(workerNode.tasksUsage.runTimeHistory).toBeInstanceOf(CircularArray)
      expect(workerNode.tasksUsage.runTimeHistory.length).toBe(0)
      expect(workerNode.tasksUsage.avgRunTime).toBeGreaterThanOrEqual(0)
      expect(workerNode.tasksUsage.medRunTime).toBe(0)
      expect(workerNode.tasksUsage.error).toBe(0)
    }
    await pool.destroy()
  })

  it('Verify that worker pool tasks usage are reset at worker choice strategy change', async () => {
    const pool = new DynamicThreadPool(
      numberOfWorkers,
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    const promises = []
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toBeDefined()
      expect(workerNode.tasksUsage.run).toBe(numberOfWorkers * 2)
      expect(workerNode.tasksUsage.running).toBe(0)
      expect(workerNode.tasksUsage.runTime).toBeGreaterThanOrEqual(0)
      expect(workerNode.tasksUsage.runTimeHistory).toBeInstanceOf(CircularArray)
      expect(workerNode.tasksUsage.runTimeHistory.length).toBe(0)
      expect(workerNode.tasksUsage.avgRunTime).toBeGreaterThanOrEqual(0)
      expect(workerNode.tasksUsage.medRunTime).toBe(0)
      expect(workerNode.tasksUsage.error).toBe(0)
    }
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toBeDefined()
      expect(workerNode.tasksUsage.run).toBe(0)
      expect(workerNode.tasksUsage.running).toBe(0)
      expect(workerNode.tasksUsage.runTime).toBe(0)
      expect(workerNode.tasksUsage.runTimeHistory).toBeInstanceOf(CircularArray)
      expect(workerNode.tasksUsage.runTimeHistory.length).toBe(0)
      expect(workerNode.tasksUsage.avgRunTime).toBe(0)
      expect(workerNode.tasksUsage.medRunTime).toBe(0)
      expect(workerNode.tasksUsage.error).toBe(0)
    }
    await pool.destroy()
  })

  it("Verify that pool event emitter 'full' event can register a callback", async () => {
    const pool = new DynamicThreadPool(
      numberOfWorkers,
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    const promises = []
    let poolFull = 0
    pool.emitter.on(PoolEvents.full, () => ++poolFull)
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // The `full` event is triggered when the number of submitted tasks at once reach the max number of workers in the dynamic pool.
    // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the dynamic pool.
    expect(poolFull).toBe(numberOfWorkers + 1)
    await pool.destroy()
  })

  it("Verify that pool event emitter 'busy' event can register a callback", async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    const promises = []
    let poolBusy = 0
    pool.emitter.on(PoolEvents.busy, () => ++poolBusy)
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
    // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the fixed pool.
    expect(poolBusy).toBe(numberOfWorkers + 1)
    await pool.destroy()
  })

  it('Verify that multiple tasks worker is working', async () => {
    const pool = new DynamicClusterPool(
      numberOfWorkers,
      numberOfWorkers * 2,
      './tests/worker-files/cluster/testMultiTasksWorker.js'
    )
    const data = { n: 10 }
    const result0 = await pool.execute(data)
    expect(result0).toBe(false)
    const result1 = await pool.execute(data, 'jsonIntegerSerialization')
    expect(result1).toBe(false)
    const result2 = await pool.execute(data, 'factorial')
    expect(result2).toBe(3628800)
    const result3 = await pool.execute(data, 'fibonacci')
    expect(result3).toBe(89)
  })
})
