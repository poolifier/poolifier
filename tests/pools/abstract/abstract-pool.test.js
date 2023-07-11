const { expect } = require('expect')
const {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes
} = require('../../../lib')
const { CircularArray } = require('../../../lib/circular-array')
const { Queue } = require('../../../lib/queue')
const { version } = require('../../../package.json')
const { waitPoolEvents } = require('../../test-utils')

describe('Abstract pool test suite', () => {
  const numberOfWorkers = 2
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
    expect(() => new FixedThreadPool(numberOfWorkers, 0)).toThrowError(
      expectedError
    )
    expect(() => new FixedThreadPool(numberOfWorkers, true)).toThrowError(
      expectedError
    )
    expect(
      () => new FixedThreadPool(numberOfWorkers, './dummyWorker.ts')
    ).toThrowError(new Error("Cannot find the worker file './dummyWorker.ts'"))
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
        'Cannot instantiate a pool with a non safe integer number of workers'
      )
    )
  })

  it('Verify that dynamic pool sizing is checked', () => {
    expect(
      () =>
        new DynamicThreadPool(2, 1, './tests/worker-files/thread/testWorker.js')
    ).toThrowError(
      new RangeError(
        'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size'
      )
    )
    expect(
      () =>
        new DynamicThreadPool(1, 1, './tests/worker-files/thread/testWorker.js')
    ).toThrowError(
      new RangeError(
        'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead'
      )
    )
    expect(
      () =>
        new DynamicThreadPool(0, 0, './tests/worker-files/thread/testWorker.js')
    ).toThrowError(
      new RangeError(
        'Cannot instantiate a dynamic pool with a pool size equal to zero'
      )
    )
  })

  it('Verify that pool options are checked', async () => {
    let pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(pool.emitter).toBeDefined()
    expect(pool.opts.enableEvents).toBe(true)
    expect(pool.opts.restartWorkerOnError).toBe(true)
    expect(pool.opts.enableTasksQueue).toBe(false)
    expect(pool.opts.tasksQueueOptions).toBeUndefined()
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false }
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
        workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
        workerChoiceStrategyOptions: {
          runTime: { median: true },
          weights: { 0: 300, 1: 200 }
        },
        enableEvents: false,
        restartWorkerOnError: false,
        enableTasksQueue: true,
        tasksQueueOptions: { concurrency: 2 },
        messageHandler: testHandler,
        errorHandler: testHandler,
        onlineHandler: testHandler,
        exitHandler: testHandler
      }
    )
    expect(pool.emitter).toBeUndefined()
    expect(pool.opts.enableEvents).toBe(false)
    expect(pool.opts.restartWorkerOnError).toBe(false)
    expect(pool.opts.enableTasksQueue).toBe(true)
    expect(pool.opts.tasksQueueOptions).toStrictEqual({ concurrency: 2 })
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LEAST_USED
    )
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      runTime: { median: true },
      weights: { 0: 300, 1: 200 }
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
            workerChoiceStrategy: 'invalidStrategy'
          }
        )
    ).toThrowError("Invalid worker choice strategy 'invalidStrategy'")
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.js',
          {
            workerChoiceStrategyOptions: 'invalidOptions'
          }
        )
    ).toThrowError(
      'Invalid worker choice strategy options: must be a plain object'
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.js',
          {
            workerChoiceStrategyOptions: { weights: {} }
          }
        )
    ).toThrowError(
      'Invalid worker choice strategy options: must have a weight for each worker node'
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.js',
          {
            workerChoiceStrategyOptions: { measurement: 'invalidMeasurement' }
          }
        )
    ).toThrowError(
      "Invalid worker choice strategy options: invalid measurement 'invalidMeasurement'"
    )
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
            enableTasksQueue: true,
            tasksQueueOptions: 'invalidTasksQueueOptions'
          }
        )
    ).toThrowError('Invalid tasks queue options: must be a plain object')
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.js',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { concurrency: 0.2 }
          }
        )
    ).toThrowError('Invalid worker tasks concurrency: must be an integer')
  })

  it('Verify that pool worker choice strategy options can be set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
    )
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false }
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        runTime: { median: false },
        waitTime: { median: false },
        elu: { median: false }
      })
    }
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: true,
        average: true,
        median: false
      }
    })
    pool.setWorkerChoiceStrategyOptions({
      runTime: { median: true },
      elu: { median: true }
    })
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      runTime: { median: true },
      elu: { median: true }
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        runTime: { median: true },
        elu: { median: true }
      })
    }
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: false,
        median: true
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: true,
        average: false,
        median: true
      }
    })
    pool.setWorkerChoiceStrategyOptions({
      runTime: { median: false },
      elu: { median: false }
    })
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      runTime: { median: false },
      elu: { median: false }
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        runTime: { median: false },
        elu: { median: false }
      })
    }
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: true,
        average: true,
        median: false
      }
    })
    expect(() =>
      pool.setWorkerChoiceStrategyOptions('invalidWorkerChoiceStrategyOptions')
    ).toThrowError(
      'Invalid worker choice strategy options: must be a plain object'
    )
    expect(() =>
      pool.setWorkerChoiceStrategyOptions({ weights: {} })
    ).toThrowError(
      'Invalid worker choice strategy options: must have a weight for each worker node'
    )
    expect(() =>
      pool.setWorkerChoiceStrategyOptions({ measurement: 'invalidMeasurement' })
    ).toThrowError(
      "Invalid worker choice strategy options: invalid measurement 'invalidMeasurement'"
    )
    await pool.destroy()
  })

  it('Verify that pool tasks queue can be enabled/disabled', async () => {
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

  it('Verify that pool tasks queue options can be set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js',
      { enableTasksQueue: true }
    )
    expect(pool.opts.tasksQueueOptions).toStrictEqual({ concurrency: 1 })
    pool.setTasksQueueOptions({ concurrency: 2 })
    expect(pool.opts.tasksQueueOptions).toStrictEqual({ concurrency: 2 })
    expect(() =>
      pool.setTasksQueueOptions('invalidTasksQueueOptions')
    ).toThrowError('Invalid tasks queue options: must be a plain object')
    expect(() => pool.setTasksQueueOptions({ concurrency: 0 })).toThrowError(
      "Invalid worker tasks concurrency '0'"
    )
    expect(() => pool.setTasksQueueOptions({ concurrency: 0.2 })).toThrowError(
      'Invalid worker tasks concurrency: must be an integer'
    )
    await pool.destroy()
  })

  it('Verify that pool info is set', async () => {
    let pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(pool.info).toStrictEqual({
      version,
      type: PoolTypes.fixed,
      worker: WorkerTypes.thread,
      ready: true,
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: numberOfWorkers,
      maxSize: numberOfWorkers,
      workerNodes: numberOfWorkers,
      idleWorkerNodes: numberOfWorkers,
      busyWorkerNodes: 0,
      executedTasks: 0,
      executingTasks: 0,
      queuedTasks: 0,
      maxQueuedTasks: 0,
      failedTasks: 0
    })
    await pool.destroy()
    pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    expect(pool.info).toStrictEqual({
      version,
      type: PoolTypes.dynamic,
      worker: WorkerTypes.cluster,
      ready: true,
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: Math.floor(numberOfWorkers / 2),
      maxSize: numberOfWorkers,
      workerNodes: Math.floor(numberOfWorkers / 2),
      idleWorkerNodes: Math.floor(numberOfWorkers / 2),
      busyWorkerNodes: 0,
      executedTasks: 0,
      executingTasks: 0,
      queuedTasks: 0,
      maxQueuedTasks: 0,
      failedTasks: 0
    })
    await pool.destroy()
  })

  it('Verify that pool worker tasks usage are initialized', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: 0,
          executing: 0,
          queued: 0,
          maxQueued: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
    }
    await pool.destroy()
  })

  it('Verify that pool worker tasks queue are initialized', async () => {
    let pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueue).toBeDefined()
      expect(workerNode.tasksQueue).toBeInstanceOf(Queue)
      expect(workerNode.tasksQueue.size).toBe(0)
      expect(workerNode.tasksQueue.maxSize).toBe(0)
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueue).toBeDefined()
      expect(workerNode.tasksQueue).toBeInstanceOf(Queue)
      expect(workerNode.tasksQueue.size).toBe(0)
      expect(workerNode.tasksQueue.maxSize).toBe(0)
    }
  })

  it('Verify that pool worker info are initialized', async () => {
    let pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.info).toStrictEqual({
        id: expect.any(Number),
        type: WorkerTypes.cluster,
        dynamic: false,
        ready: true
      })
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.info).toStrictEqual({
        id: expect.any(Number),
        type: WorkerTypes.thread,
        dynamic: false,
        ready: true
      })
    }
  })

  it('Verify that pool worker tasks usage are computed', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: 0,
          executing: maxMultiplier,
          queued: 0,
          maxQueued: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          maxQueued: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
    }
    await pool.destroy()
  })

  it('Verify that pool worker tasks usage are reset at worker choice strategy change', async () => {
    const pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(maxMultiplier)
      expect(workerNode.usage.runTime.history.length).toBe(0)
      expect(workerNode.usage.waitTime.history.length).toBe(0)
      expect(workerNode.usage.elu.idle.history.length).toBe(0)
      expect(workerNode.usage.elu.active.history.length).toBe(0)
    }
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: 0,
          executing: 0,
          queued: 0,
          maxQueued: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.runTime.history.length).toBe(0)
      expect(workerNode.usage.waitTime.history.length).toBe(0)
      expect(workerNode.usage.elu.idle.history.length).toBe(0)
      expect(workerNode.usage.elu.active.history.length).toBe(0)
    }
    await pool.destroy()
  })

  it("Verify that pool event emitter 'full' event can register a callback", async () => {
    const pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    const promises = new Set()
    let poolFull = 0
    let poolInfo
    pool.emitter.on(PoolEvents.full, info => {
      ++poolFull
      poolInfo = info
    })
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    // The `full` event is triggered when the number of submitted tasks at once reach the maximum number of workers in the dynamic pool.
    // So in total numberOfWorkers * 2 - 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the dynamic pool with min = (max = numberOfWorkers) / 2.
    expect(poolFull).toBe(numberOfWorkers * 2 - 1)
    expect(poolInfo).toStrictEqual({
      version,
      type: PoolTypes.dynamic,
      worker: WorkerTypes.thread,
      ready: expect.any(Boolean),
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: expect.any(Number),
      maxSize: expect.any(Number),
      workerNodes: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      busyWorkerNodes: expect.any(Number),
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      queuedTasks: expect.any(Number),
      maxQueuedTasks: expect.any(Number),
      failedTasks: expect.any(Number)
    })
    await pool.destroy()
  })

  it("Verify that pool event emitter 'ready' event can register a callback", async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    let poolInfo
    let poolReady = 0
    pool.emitter.on(PoolEvents.ready, info => {
      ++poolReady
      poolInfo = info
    })
    await waitPoolEvents(pool, PoolEvents.ready, 1)
    expect(poolReady).toBe(1)
    expect(poolInfo).toStrictEqual({
      version,
      type: PoolTypes.dynamic,
      worker: WorkerTypes.cluster,
      ready: true,
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: expect.any(Number),
      maxSize: expect.any(Number),
      workerNodes: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      busyWorkerNodes: expect.any(Number),
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      queuedTasks: expect.any(Number),
      maxQueuedTasks: expect.any(Number),
      failedTasks: expect.any(Number)
    })
    await pool.destroy()
  })

  it("Verify that pool event emitter 'busy' event can register a callback", async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.js'
    )
    const promises = new Set()
    let poolBusy = 0
    let poolInfo
    pool.emitter.on(PoolEvents.busy, info => {
      ++poolBusy
      poolInfo = info
    })
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
    // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the fixed pool.
    expect(poolBusy).toBe(numberOfWorkers + 1)
    expect(poolInfo).toStrictEqual({
      version,
      type: PoolTypes.fixed,
      worker: WorkerTypes.thread,
      ready: expect.any(Boolean),
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: expect.any(Number),
      maxSize: expect.any(Number),
      workerNodes: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      busyWorkerNodes: expect.any(Number),
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      queuedTasks: expect.any(Number),
      maxQueuedTasks: expect.any(Number),
      failedTasks: expect.any(Number)
    })
    await pool.destroy()
  })

  it('Verify that multiple tasks worker is working', async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testMultiTasksWorker.js'
    )
    const data = { n: 10 }
    const result0 = await pool.execute(data)
    expect(result0).toStrictEqual({ ok: 1 })
    const result1 = await pool.execute(data, 'jsonIntegerSerialization')
    expect(result1).toStrictEqual({ ok: 1 })
    const result2 = await pool.execute(data, 'factorial')
    expect(result2).toBe(3628800)
    const result3 = await pool.execute(data, 'fibonacci')
    expect(result3).toBe(55)
  })
})
