import { EventEmitterAsyncResource } from 'node:events'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHook, executionAsyncId } from 'node:async_hooks'
import { expect } from 'expect'
import { restore, stub } from 'sinon'
import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes
} from '../../lib/index.js'
import { CircularArray } from '../../lib/circular-array.js'
import { Deque } from '../../lib/deque.js'
import { DEFAULT_TASK_NAME } from '../../lib/utils.js'
import { waitPoolEvents } from '../test-utils.js'
import { WorkerNode } from '../../lib/pools/worker-node.js'

describe('Abstract pool test suite', () => {
  const version = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../..', 'package.json'),
      'utf8'
    )
  ).version
  const numberOfWorkers = 2
  class StubPoolWithIsMain extends FixedThreadPool {
    isMain () {
      return false
    }
  }

  afterEach(() => {
    restore()
  })

  it('Verify that pool can be created and destroyed', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool).toBeInstanceOf(FixedThreadPool)
    await pool.destroy()
  })

  it('Verify that pool cannot be created from a non main thread/process', () => {
    expect(
      () =>
        new StubPoolWithIsMain(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            errorHandler: e => console.error(e)
          }
        )
    ).toThrow(
      new Error(
        'Cannot start a pool from a worker with the same type as the pool'
      )
    )
  })

  it('Verify that pool statuses properties are set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.started).toBe(true)
    expect(pool.starting).toBe(false)
    expect(pool.destroying).toBe(false)
    await pool.destroy()
  })

  it('Verify that filePath is checked', () => {
    expect(() => new FixedThreadPool(numberOfWorkers)).toThrow(
      new TypeError('The worker file path must be specified')
    )
    expect(() => new FixedThreadPool(numberOfWorkers, 0)).toThrow(
      new TypeError('The worker file path must be a string')
    )
    expect(
      () => new FixedThreadPool(numberOfWorkers, './dummyWorker.ts')
    ).toThrow(new Error("Cannot find the worker file './dummyWorker.ts'"))
  })

  it('Verify that numberOfWorkers is checked', () => {
    expect(
      () =>
        new FixedThreadPool(
          undefined,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new Error(
        'Cannot instantiate a pool without specifying the number of workers'
      )
    )
  })

  it('Verify that a negative number of workers is checked', () => {
    expect(
      () =>
        new FixedClusterPool(-1, './tests/worker-files/cluster/testWorker.js')
    ).toThrow(
      new RangeError(
        'Cannot instantiate a pool with a negative number of workers'
      )
    )
  })

  it('Verify that a non integer number of workers is checked', () => {
    expect(
      () =>
        new FixedThreadPool(0.25, './tests/worker-files/thread/testWorker.mjs')
    ).toThrow(
      new TypeError(
        'Cannot instantiate a pool with a non safe integer number of workers'
      )
    )
  })

  it('Verify that dynamic pool sizing is checked', () => {
    expect(
      () =>
        new DynamicClusterPool(
          1,
          undefined,
          './tests/worker-files/cluster/testWorker.js'
        )
    ).toThrow(
      new TypeError(
        'Cannot instantiate a dynamic pool without specifying the maximum pool size'
      )
    )
    expect(
      () =>
        new DynamicThreadPool(
          0.5,
          1,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new TypeError(
        'Cannot instantiate a pool with a non safe integer number of workers'
      )
    )
    expect(
      () =>
        new DynamicClusterPool(
          0,
          0.5,
          './tests/worker-files/cluster/testWorker.js'
        )
    ).toThrow(
      new TypeError(
        'Cannot instantiate a dynamic pool with a non safe integer maximum pool size'
      )
    )
    expect(
      () =>
        new DynamicThreadPool(
          2,
          1,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new RangeError(
        'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size'
      )
    )
    expect(
      () =>
        new DynamicThreadPool(
          0,
          0,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new RangeError(
        'Cannot instantiate a dynamic pool with a maximum pool size equal to zero'
      )
    )
    expect(
      () =>
        new DynamicClusterPool(
          1,
          1,
          './tests/worker-files/cluster/testWorker.js'
        )
    ).toThrow(
      new RangeError(
        'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead'
      )
    )
  })

  it('Verify that pool options are checked', async () => {
    let pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.emitter).toBeInstanceOf(EventEmitterAsyncResource)
    expect(pool.opts).toStrictEqual({
      startWorkers: true,
      enableEvents: true,
      restartWorkerOnError: true,
      enableTasksQueue: false,
      workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      workerChoiceStrategyOptions: {
        retries: 6,
        runTime: { median: false },
        waitTime: { median: false },
        elu: { median: false }
      }
    })
    expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
      retries: 6,
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false }
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        retries: 6,
        runTime: { median: false },
        waitTime: { median: false },
        elu: { median: false }
      })
    }
    await pool.destroy()
    const testHandler = () => console.info('test handler executed')
    pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
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
    expect(pool.opts).toStrictEqual({
      startWorkers: true,
      enableEvents: false,
      restartWorkerOnError: false,
      enableTasksQueue: true,
      tasksQueueOptions: {
        concurrency: 2,
        size: Math.pow(numberOfWorkers, 2),
        taskStealing: true,
        tasksStealingOnBackPressure: true,
        tasksFinishedTimeout: 2000
      },
      workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
      workerChoiceStrategyOptions: {
        retries: 6,
        runTime: { median: true },
        waitTime: { median: false },
        elu: { median: false },
        weights: { 0: 300, 1: 200 }
      },
      onlineHandler: testHandler,
      messageHandler: testHandler,
      errorHandler: testHandler,
      exitHandler: testHandler
    })
    expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
      retries: 6,
      runTime: { median: true },
      waitTime: { median: false },
      elu: { median: false },
      weights: { 0: 300, 1: 200 }
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        retries: 6,
        runTime: { median: true },
        waitTime: { median: false },
        elu: { median: false },
        weights: { 0: 300, 1: 200 }
      })
    }
    await pool.destroy()
  })

  it('Verify that pool options are validated', () => {
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            workerChoiceStrategy: 'invalidStrategy'
          }
        )
    ).toThrow(new Error("Invalid worker choice strategy 'invalidStrategy'"))
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            workerChoiceStrategyOptions: {
              retries: 'invalidChoiceRetries'
            }
          }
        )
    ).toThrow(
      new TypeError(
        'Invalid worker choice strategy options: retries must be an integer'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            workerChoiceStrategyOptions: {
              retries: -1
            }
          }
        )
    ).toThrow(
      new RangeError(
        "Invalid worker choice strategy options: retries '-1' must be greater or equal than zero"
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            workerChoiceStrategyOptions: { weights: {} }
          }
        )
    ).toThrow(
      new Error(
        'Invalid worker choice strategy options: must have a weight for each worker node'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            workerChoiceStrategyOptions: { measurement: 'invalidMeasurement' }
          }
        )
    ).toThrow(
      new Error(
        "Invalid worker choice strategy options: invalid measurement 'invalidMeasurement'"
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: 'invalidTasksQueueOptions'
          }
        )
    ).toThrow(
      new TypeError('Invalid tasks queue options: must be a plain object')
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { concurrency: 0 }
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks concurrency: 0 is a negative integer or zero'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { concurrency: -1 }
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks concurrency: -1 is a negative integer or zero'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { concurrency: 0.2 }
          }
        )
    ).toThrow(
      new TypeError('Invalid worker node tasks concurrency: must be an integer')
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { size: 0 }
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks queue size: 0 is a negative integer or zero'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { size: -1 }
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks queue size: -1 is a negative integer or zero'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { size: 0.2 }
          }
        )
    ).toThrow(
      new TypeError('Invalid worker node tasks queue size: must be an integer')
    )
  })

  it('Verify that pool worker choice strategy options can be set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
    )
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      retries: 6,
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false }
    })
    expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
      retries: 6,
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false }
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        retries: 6,
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
      retries: 6,
      runTime: { median: true },
      waitTime: { median: false },
      elu: { median: true }
    })
    expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
      retries: 6,
      runTime: { median: true },
      waitTime: { median: false },
      elu: { median: true }
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        retries: 6,
        runTime: { median: true },
        waitTime: { median: false },
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
      retries: 6,
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false }
    })
    expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
      retries: 6,
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false }
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        retries: 6,
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
    expect(() =>
      pool.setWorkerChoiceStrategyOptions('invalidWorkerChoiceStrategyOptions')
    ).toThrow(
      new TypeError(
        'Invalid worker choice strategy options: must be a plain object'
      )
    )
    expect(() =>
      pool.setWorkerChoiceStrategyOptions({
        retries: 'invalidChoiceRetries'
      })
    ).toThrow(
      new TypeError(
        'Invalid worker choice strategy options: retries must be an integer'
      )
    )
    expect(() => pool.setWorkerChoiceStrategyOptions({ retries: -1 })).toThrow(
      new RangeError(
        "Invalid worker choice strategy options: retries '-1' must be greater or equal than zero"
      )
    )
    expect(() => pool.setWorkerChoiceStrategyOptions({ weights: {} })).toThrow(
      new Error(
        'Invalid worker choice strategy options: must have a weight for each worker node'
      )
    )
    expect(() =>
      pool.setWorkerChoiceStrategyOptions({ measurement: 'invalidMeasurement' })
    ).toThrow(
      new Error(
        "Invalid worker choice strategy options: invalid measurement 'invalidMeasurement'"
      )
    )
    await pool.destroy()
  })

  it('Verify that pool tasks queue can be enabled/disabled', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.opts.enableTasksQueue).toBe(false)
    expect(pool.opts.tasksQueueOptions).toBeUndefined()
    pool.enableTasksQueue(true)
    expect(pool.opts.enableTasksQueue).toBe(true)
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      concurrency: 1,
      size: Math.pow(numberOfWorkers, 2),
      taskStealing: true,
      tasksStealingOnBackPressure: true,
      tasksFinishedTimeout: 2000
    })
    pool.enableTasksQueue(true, { concurrency: 2 })
    expect(pool.opts.enableTasksQueue).toBe(true)
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      concurrency: 2,
      size: Math.pow(numberOfWorkers, 2),
      taskStealing: true,
      tasksStealingOnBackPressure: true,
      tasksFinishedTimeout: 2000
    })
    pool.enableTasksQueue(false)
    expect(pool.opts.enableTasksQueue).toBe(false)
    expect(pool.opts.tasksQueueOptions).toBeUndefined()
    await pool.destroy()
  })

  it('Verify that pool tasks queue options can be set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
      { enableTasksQueue: true }
    )
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      concurrency: 1,
      size: Math.pow(numberOfWorkers, 2),
      taskStealing: true,
      tasksStealingOnBackPressure: true,
      tasksFinishedTimeout: 2000
    })
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueueBackPressureSize).toBe(
        pool.opts.tasksQueueOptions.size
      )
    }
    pool.setTasksQueueOptions({
      concurrency: 2,
      size: 2,
      taskStealing: false,
      tasksStealingOnBackPressure: false,
      tasksFinishedTimeout: 3000
    })
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      concurrency: 2,
      size: 2,
      taskStealing: false,
      tasksStealingOnBackPressure: false,
      tasksFinishedTimeout: 3000
    })
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueueBackPressureSize).toBe(
        pool.opts.tasksQueueOptions.size
      )
    }
    pool.setTasksQueueOptions({
      concurrency: 1,
      taskStealing: true,
      tasksStealingOnBackPressure: true
    })
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      concurrency: 1,
      size: Math.pow(numberOfWorkers, 2),
      taskStealing: true,
      tasksStealingOnBackPressure: true,
      tasksFinishedTimeout: 2000
    })
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueueBackPressureSize).toBe(
        pool.opts.tasksQueueOptions.size
      )
    }
    expect(() => pool.setTasksQueueOptions('invalidTasksQueueOptions')).toThrow(
      new TypeError('Invalid tasks queue options: must be a plain object')
    )
    expect(() => pool.setTasksQueueOptions({ concurrency: 0 })).toThrow(
      new RangeError(
        'Invalid worker node tasks concurrency: 0 is a negative integer or zero'
      )
    )
    expect(() => pool.setTasksQueueOptions({ concurrency: -1 })).toThrow(
      new RangeError(
        'Invalid worker node tasks concurrency: -1 is a negative integer or zero'
      )
    )
    expect(() => pool.setTasksQueueOptions({ concurrency: 0.2 })).toThrow(
      new TypeError('Invalid worker node tasks concurrency: must be an integer')
    )
    expect(() => pool.setTasksQueueOptions({ size: 0 })).toThrow(
      new RangeError(
        'Invalid worker node tasks queue size: 0 is a negative integer or zero'
      )
    )
    expect(() => pool.setTasksQueueOptions({ size: -1 })).toThrow(
      new RangeError(
        'Invalid worker node tasks queue size: -1 is a negative integer or zero'
      )
    )
    expect(() => pool.setTasksQueueOptions({ size: 0.2 })).toThrow(
      new TypeError('Invalid worker node tasks queue size: must be an integer')
    )
    await pool.destroy()
  })

  it('Verify that pool info is set', async () => {
    let pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.info).toStrictEqual({
      version,
      type: PoolTypes.fixed,
      worker: WorkerTypes.thread,
      started: true,
      ready: true,
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: numberOfWorkers,
      maxSize: numberOfWorkers,
      workerNodes: numberOfWorkers,
      idleWorkerNodes: numberOfWorkers,
      busyWorkerNodes: 0,
      executedTasks: 0,
      executingTasks: 0,
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
      started: true,
      ready: true,
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: Math.floor(numberOfWorkers / 2),
      maxSize: numberOfWorkers,
      workerNodes: Math.floor(numberOfWorkers / 2),
      idleWorkerNodes: Math.floor(numberOfWorkers / 2),
      busyWorkerNodes: 0,
      executedTasks: 0,
      executingTasks: 0,
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
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: 0,
          executing: 0,
          queued: 0,
          maxQueued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: new CircularArray()
        },
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.tasksQueue).toBeInstanceOf(Deque)
      expect(workerNode.tasksQueue.size).toBe(0)
      expect(workerNode.tasksQueue.maxSize).toBe(0)
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.tasksQueue).toBeInstanceOf(Deque)
      expect(workerNode.tasksQueue.size).toBe(0)
      expect(workerNode.tasksQueue.maxSize).toBe(0)
    }
    await pool.destroy()
  })

  it('Verify that pool worker info are initialized', async () => {
    let pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
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
      './tests/worker-files/thread/testWorker.mjs'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.info).toStrictEqual({
        id: expect.any(Number),
        type: WorkerTypes.thread,
        dynamic: false,
        ready: true
      })
    }
    await pool.destroy()
  })

  it('Verify that pool statuses are checked at start or destroy', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.info.started).toBe(true)
    expect(pool.info.ready).toBe(true)
    expect(() => pool.start()).toThrow(
      new Error('Cannot start an already started pool')
    )
    await pool.destroy()
    expect(pool.info.started).toBe(false)
    expect(pool.info.ready).toBe(false)
    await expect(pool.destroy()).rejects.toThrow(
      new Error('Cannot destroy an already destroyed pool')
    )
  })

  it('Verify that pool can be started after initialization', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js',
      {
        startWorkers: false
      }
    )
    expect(pool.info.started).toBe(false)
    expect(pool.info.ready).toBe(false)
    expect(pool.readyEventEmitted).toBe(false)
    expect(pool.workerNodes).toStrictEqual([])
    await expect(pool.execute()).rejects.toThrow(
      new Error('Cannot execute a task on not started pool')
    )
    pool.start()
    expect(pool.info.started).toBe(true)
    expect(pool.info.ready).toBe(true)
    await waitPoolEvents(pool, PoolEvents.ready, 1)
    expect(pool.readyEventEmitted).toBe(true)
    expect(pool.workerNodes.length).toBe(numberOfWorkers)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
    }
    await pool.destroy()
  })

  it('Verify that pool execute() arguments are checked', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    await expect(pool.execute(undefined, 0)).rejects.toThrow(
      new TypeError('name argument must be a string')
    )
    await expect(pool.execute(undefined, '')).rejects.toThrow(
      new TypeError('name argument must not be an empty string')
    )
    await expect(pool.execute(undefined, undefined, {})).rejects.toThrow(
      new TypeError('transferList argument must be an array')
    )
    await expect(pool.execute(undefined, 'unknown')).rejects.toBe(
      "Task function 'unknown' not found"
    )
    await pool.destroy()
    await expect(pool.execute()).rejects.toThrow(
      new Error('Cannot execute a task on not started pool')
    )
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
          sequentiallyStolen: 0,
          stolen: 0,
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
          sequentiallyStolen: 0,
          stolen: 0,
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
      './tests/worker-files/thread/testWorker.mjs'
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
          sequentiallyStolen: 0,
          stolen: 0,
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
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        numberOfWorkers * maxMultiplier
      )
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
          sequentiallyStolen: 0,
          stolen: 0,
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

  it("Verify that pool event emitter 'ready' event can register a callback", async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    let poolInfo
    let poolReady = 0
    pool.emitter.on(PoolEvents.ready, info => {
      ++poolReady
      poolInfo = info
    })
    await waitPoolEvents(pool, PoolEvents.ready, 1)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.ready])
    expect(poolReady).toBe(1)
    expect(poolInfo).toStrictEqual({
      version,
      type: PoolTypes.dynamic,
      worker: WorkerTypes.cluster,
      started: true,
      ready: true,
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: expect.any(Number),
      maxSize: expect.any(Number),
      workerNodes: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      busyWorkerNodes: expect.any(Number),
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number)
    })
    await pool.destroy()
  })

  it("Verify that pool event emitter 'busy' event can register a callback", async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolBusy = 0
    let poolInfo
    pool.emitter.on(PoolEvents.busy, info => {
      ++poolBusy
      poolInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.busy])
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
      started: true,
      ready: true,
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: expect.any(Number),
      maxSize: expect.any(Number),
      workerNodes: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      busyWorkerNodes: expect.any(Number),
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number)
    })
    await pool.destroy()
  })

  it("Verify that pool event emitter 'full' event can register a callback", async () => {
    const pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolFull = 0
    let poolInfo
    pool.emitter.on(PoolEvents.full, info => {
      ++poolFull
      poolInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.full])
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    expect(poolFull).toBe(1)
    expect(poolInfo).toStrictEqual({
      version,
      type: PoolTypes.dynamic,
      worker: WorkerTypes.thread,
      started: true,
      ready: true,
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: expect.any(Number),
      maxSize: expect.any(Number),
      workerNodes: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      busyWorkerNodes: expect.any(Number),
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number)
    })
    await pool.destroy()
  })

  it("Verify that pool event emitter 'backPressure' event can register a callback", async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
      {
        enableTasksQueue: true
      }
    )
    stub(pool, 'hasBackPressure').returns(true)
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolBackPressure = 0
    let poolInfo
    pool.emitter.on(PoolEvents.backPressure, info => {
      ++poolBackPressure
      poolInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.backPressure])
    for (let i = 0; i < numberOfWorkers + 1; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    expect(poolBackPressure).toBe(1)
    expect(poolInfo).toStrictEqual({
      version,
      type: PoolTypes.fixed,
      worker: WorkerTypes.thread,
      started: true,
      ready: true,
      strategy: WorkerChoiceStrategies.ROUND_ROBIN,
      minSize: expect.any(Number),
      maxSize: expect.any(Number),
      workerNodes: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      busyWorkerNodes: expect.any(Number),
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      maxQueuedTasks: expect.any(Number),
      queuedTasks: expect.any(Number),
      backPressure: true,
      stolenTasks: expect.any(Number),
      failedTasks: expect.any(Number)
    })
    expect(pool.hasBackPressure.callCount).toBe(5)
    await pool.destroy()
  })

  it('Verify that destroy() waits for queued tasks to finish', async () => {
    const tasksFinishedTimeout = 2500
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/asyncWorker.mjs',
      {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout }
      }
    )
    const maxMultiplier = 4
    let tasksFinished = 0
    for (const workerNode of pool.workerNodes) {
      workerNode.on('taskFinished', () => {
        ++tasksFinished
      })
    }
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      pool.execute()
    }
    expect(pool.info.queuedTasks).toBeGreaterThan(0)
    const startTime = performance.now()
    await pool.destroy()
    const elapsedTime = performance.now() - startTime
    expect(tasksFinished).toBe(numberOfWorkers * maxMultiplier)
    expect(elapsedTime).toBeGreaterThanOrEqual(2000)
    expect(elapsedTime).toBeLessThanOrEqual(tasksFinishedTimeout)
  })

  it('Verify that destroy() waits until the tasks finished timeout is reached', async () => {
    const tasksFinishedTimeout = 1000
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/asyncWorker.mjs',
      {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout }
      }
    )
    const maxMultiplier = 4
    let tasksFinished = 0
    for (const workerNode of pool.workerNodes) {
      workerNode.on('taskFinished', () => {
        ++tasksFinished
      })
    }
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      pool.execute()
    }
    expect(pool.info.queuedTasks).toBeGreaterThan(0)
    const startTime = performance.now()
    await pool.destroy()
    const elapsedTime = performance.now() - startTime
    expect(tasksFinished).toBe(0)
    expect(elapsedTime).toBeLessThanOrEqual(tasksFinishedTimeout + 100)
  })

  it('Verify that pool asynchronous resource track tasks execution', async () => {
    let taskAsyncId
    let initCalls = 0
    let beforeCalls = 0
    let afterCalls = 0
    let resolveCalls = 0
    const hook = createHook({
      init (asyncId, type) {
        if (type === 'poolifier:task') {
          initCalls++
          taskAsyncId = asyncId
        }
      },
      before (asyncId) {
        if (asyncId === taskAsyncId) beforeCalls++
      },
      after (asyncId) {
        if (asyncId === taskAsyncId) afterCalls++
      },
      promiseResolve () {
        if (executionAsyncId() === taskAsyncId) resolveCalls++
      }
    })
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    hook.enable()
    await pool.execute()
    hook.disable()
    expect(initCalls).toBe(1)
    expect(beforeCalls).toBe(1)
    expect(afterCalls).toBe(1)
    expect(resolveCalls).toBe(1)
    await pool.destroy()
  })

  it('Verify that hasTaskFunction() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    expect(dynamicThreadPool.hasTaskFunction(DEFAULT_TASK_NAME)).toBe(true)
    expect(dynamicThreadPool.hasTaskFunction('jsonIntegerSerialization')).toBe(
      true
    )
    expect(dynamicThreadPool.hasTaskFunction('factorial')).toBe(true)
    expect(dynamicThreadPool.hasTaskFunction('fibonacci')).toBe(true)
    expect(dynamicThreadPool.hasTaskFunction('unknown')).toBe(false)
    await dynamicThreadPool.destroy()
    const fixedClusterPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testMultipleTaskFunctionsWorker.js'
    )
    await waitPoolEvents(fixedClusterPool, PoolEvents.ready, 1)
    expect(fixedClusterPool.hasTaskFunction(DEFAULT_TASK_NAME)).toBe(true)
    expect(fixedClusterPool.hasTaskFunction('jsonIntegerSerialization')).toBe(
      true
    )
    expect(fixedClusterPool.hasTaskFunction('factorial')).toBe(true)
    expect(fixedClusterPool.hasTaskFunction('fibonacci')).toBe(true)
    expect(fixedClusterPool.hasTaskFunction('unknown')).toBe(false)
    await fixedClusterPool.destroy()
  })

  it('Verify that addTaskFunction() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    await expect(
      dynamicThreadPool.addTaskFunction(0, () => {})
    ).rejects.toThrow(new TypeError('name argument must be a string'))
    await expect(
      dynamicThreadPool.addTaskFunction('', () => {})
    ).rejects.toThrow(
      new TypeError('name argument must not be an empty string')
    )
    await expect(dynamicThreadPool.addTaskFunction('test', 0)).rejects.toThrow(
      new TypeError('fn argument must be a function')
    )
    await expect(dynamicThreadPool.addTaskFunction('test', '')).rejects.toThrow(
      new TypeError('fn argument must be a function')
    )
    expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'test'
    ])
    const echoTaskFunction = data => {
      return data
    }
    await expect(
      dynamicThreadPool.addTaskFunction('echo', echoTaskFunction)
    ).resolves.toBe(true)
    expect(dynamicThreadPool.taskFunctions.size).toBe(1)
    expect(dynamicThreadPool.taskFunctions.get('echo')).toStrictEqual(
      echoTaskFunction
    )
    expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'test',
      'echo'
    ])
    const taskFunctionData = { test: 'test' }
    const echoResult = await dynamicThreadPool.execute(taskFunctionData, 'echo')
    expect(echoResult).toStrictEqual(taskFunctionData)
    for (const workerNode of dynamicThreadPool.workerNodes) {
      expect(workerNode.getTaskFunctionWorkerUsage('echo')).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: new CircularArray()
        },
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
          }
        }
      })
    }
    await dynamicThreadPool.destroy()
  })

  it('Verify that removeTaskFunction() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'test'
    ])
    await expect(dynamicThreadPool.removeTaskFunction('test')).rejects.toThrow(
      new Error('Cannot remove a task function not handled on the pool side')
    )
    const echoTaskFunction = data => {
      return data
    }
    await dynamicThreadPool.addTaskFunction('echo', echoTaskFunction)
    expect(dynamicThreadPool.taskFunctions.size).toBe(1)
    expect(dynamicThreadPool.taskFunctions.get('echo')).toStrictEqual(
      echoTaskFunction
    )
    expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'test',
      'echo'
    ])
    await expect(dynamicThreadPool.removeTaskFunction('echo')).resolves.toBe(
      true
    )
    expect(dynamicThreadPool.taskFunctions.size).toBe(0)
    expect(dynamicThreadPool.taskFunctions.get('echo')).toBeUndefined()
    expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'test'
    ])
    await dynamicThreadPool.destroy()
  })

  it('Verify that listTaskFunctionNames() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'jsonIntegerSerialization',
      'factorial',
      'fibonacci'
    ])
    await dynamicThreadPool.destroy()
    const fixedClusterPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testMultipleTaskFunctionsWorker.js'
    )
    await waitPoolEvents(fixedClusterPool, PoolEvents.ready, 1)
    expect(fixedClusterPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'jsonIntegerSerialization',
      'factorial',
      'fibonacci'
    ])
    await fixedClusterPool.destroy()
  })

  it('Verify that setDefaultTaskFunction() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    const workerId = dynamicThreadPool.workerNodes[0].info.id
    await expect(dynamicThreadPool.setDefaultTaskFunction(0)).rejects.toThrow(
      new Error(
        `Task function operation 'default' failed on worker ${workerId} with error: 'TypeError: name parameter is not a string'`
      )
    )
    await expect(
      dynamicThreadPool.setDefaultTaskFunction(DEFAULT_TASK_NAME)
    ).rejects.toThrow(
      new Error(
        `Task function operation 'default' failed on worker ${workerId} with error: 'Error: Cannot set the default task function reserved name as the default task function'`
      )
    )
    await expect(
      dynamicThreadPool.setDefaultTaskFunction('unknown')
    ).rejects.toThrow(
      new Error(
        `Task function operation 'default' failed on worker ${workerId} with error: 'Error: Cannot set the default task function to a non-existing task function'`
      )
    )
    expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'jsonIntegerSerialization',
      'factorial',
      'fibonacci'
    ])
    await expect(
      dynamicThreadPool.setDefaultTaskFunction('factorial')
    ).resolves.toBe(true)
    expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'factorial',
      'jsonIntegerSerialization',
      'fibonacci'
    ])
    await expect(
      dynamicThreadPool.setDefaultTaskFunction('fibonacci')
    ).resolves.toBe(true)
    expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'fibonacci',
      'jsonIntegerSerialization',
      'factorial'
    ])
    await dynamicThreadPool.destroy()
  })

  it('Verify that multiple task functions worker is working', async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testMultipleTaskFunctionsWorker.js'
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
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(4)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.info.taskFunctionNames).toStrictEqual([
        DEFAULT_TASK_NAME,
        'jsonIntegerSerialization',
        'factorial',
        'fibonacci'
      ])
      expect(workerNode.taskFunctionsUsage.size).toBe(3)
      for (const name of pool.listTaskFunctionNames()) {
        expect(workerNode.getTaskFunctionWorkerUsage(name)).toStrictEqual({
          tasks: {
            executed: expect.any(Number),
            executing: 0,
            failed: 0,
            queued: 0,
            sequentiallyStolen: 0,
            stolen: 0
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
        expect(
          workerNode.getTaskFunctionWorkerUsage(name).tasks.executed
        ).toBeGreaterThan(0)
      }
      expect(
        workerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME)
      ).toStrictEqual(
        workerNode.getTaskFunctionWorkerUsage(
          workerNode.info.taskFunctionNames[1]
        )
      )
    }
    await pool.destroy()
  })

  it('Verify sendKillMessageToWorker()', async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    const workerNodeKey = 0
    await expect(
      pool.sendKillMessageToWorker(workerNodeKey)
    ).resolves.toBeUndefined()
    await expect(
      pool.sendKillMessageToWorker(numberOfWorkers)
    ).rejects.toStrictEqual(
      new Error(`Invalid worker node key '${numberOfWorkers}'`)
    )
    await pool.destroy()
  })

  it('Verify sendTaskFunctionOperationToWorker()', async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    const workerNodeKey = 0
    await expect(
      pool.sendTaskFunctionOperationToWorker(workerNodeKey, {
        taskFunctionOperation: 'add',
        taskFunctionName: 'empty',
        taskFunction: (() => {}).toString()
      })
    ).resolves.toBe(true)
    expect(
      pool.workerNodes[workerNodeKey].info.taskFunctionNames
    ).toStrictEqual([DEFAULT_TASK_NAME, 'test', 'empty'])
    await pool.destroy()
  })

  it('Verify sendTaskFunctionOperationToWorkers()', async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.js'
    )
    await expect(
      pool.sendTaskFunctionOperationToWorkers({
        taskFunctionOperation: 'add',
        taskFunctionName: 'empty',
        taskFunction: (() => {}).toString()
      })
    ).resolves.toBe(true)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.info.taskFunctionNames).toStrictEqual([
        DEFAULT_TASK_NAME,
        'test',
        'empty'
      ])
    }
    await pool.destroy()
  })
})
