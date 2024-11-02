import { expect } from '@std/expect'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { createHook, executionAsyncId } from 'node:async_hooks'
import { EventEmitterAsyncResource } from 'node:events'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CircularBuffer } from '../../lib/circular-buffer.cjs'
import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes,
} from '../../lib/index.cjs'
import { WorkerNode } from '../../lib/pools/worker-node.cjs'
import { PriorityQueue } from '../../lib/queues/priority-queue.cjs'
import { defaultBucketSize } from '../../lib/queues/queue-types.cjs'
import { DEFAULT_TASK_NAME } from '../../lib/utils.cjs'
import { waitPoolEvents } from '../test-utils.cjs'

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
            errorHandler: e => console.error(e),
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
    expect(pool.started).toBe(false)
    expect(pool.starting).toBe(false)
    expect(pool.destroying).toBe(false)
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
        new FixedClusterPool(-1, './tests/worker-files/cluster/testWorker.cjs')
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

  it('Verify that pool arguments number and pool type are checked', () => {
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          undefined,
          numberOfWorkers * 2
        )
    ).toThrow(
      new Error(
        'Cannot instantiate a fixed pool with a maximum number of workers specified at initialization'
      )
    )
  })

  it('Verify that dynamic pool sizing is checked', () => {
    expect(
      () =>
        new DynamicClusterPool(
          1,
          undefined,
          './tests/worker-files/cluster/testWorker.cjs'
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
          './tests/worker-files/cluster/testWorker.cjs'
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
          './tests/worker-files/cluster/testWorker.cjs'
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
    expect(pool.emitter.eventNames()).toStrictEqual([])
    expect(pool.opts).toStrictEqual({
      enableEvents: true,
      enableTasksQueue: false,
      restartWorkerOnError: true,
      startWorkers: true,
      workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        elu: { median: false },
        runTime: { median: false },
        waitTime: { median: false },
        weights: expect.objectContaining({
          0: expect.any(Number),
          [pool.info.maxSize - 1]: expect.any(Number),
        }),
      })
    }
    await pool.destroy()
    const testHandler = () => console.info('test handler executed')
    pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
      {
        enableEvents: false,
        enableTasksQueue: true,
        errorHandler: testHandler,
        exitHandler: testHandler,
        messageHandler: testHandler,
        onlineHandler: testHandler,
        restartWorkerOnError: false,
        tasksQueueOptions: { concurrency: 2 },
        workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
        workerChoiceStrategyOptions: {
          runTime: { median: true },
          weights: { 0: 300, 1: 200 },
        },
      }
    )
    expect(pool.emitter).toBeUndefined()
    expect(pool.opts).toStrictEqual({
      enableEvents: false,
      enableTasksQueue: true,
      errorHandler: testHandler,
      exitHandler: testHandler,
      messageHandler: testHandler,
      onlineHandler: testHandler,
      restartWorkerOnError: false,
      startWorkers: true,
      tasksQueueOptions: {
        concurrency: 2,
        size: Math.pow(numberOfWorkers, 2),
        tasksFinishedTimeout: 2000,
        tasksStealingOnBackPressure: true,
        tasksStealingRatio: 0.6,
        taskStealing: true,
      },
      workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
      workerChoiceStrategyOptions: {
        runTime: { median: true },
        weights: { 0: 300, 1: 200 },
      },
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        elu: { median: false },
        runTime: { median: true },
        waitTime: { median: false },
        weights: { 0: 300, 1: 200 },
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
            workerChoiceStrategy: 'invalidStrategy',
          }
        )
    ).toThrow(new Error("Invalid worker choice strategy 'invalidStrategy'"))
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            workerChoiceStrategyOptions: { weights: {} },
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
            workerChoiceStrategyOptions: { measurement: 'invalidMeasurement' },
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
            tasksQueueOptions: 'invalidTasksQueueOptions',
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
            tasksQueueOptions: { concurrency: 0 },
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
            tasksQueueOptions: { concurrency: -1 },
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
            tasksQueueOptions: { concurrency: 0.2 },
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
            tasksQueueOptions: { size: 0 },
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
            tasksQueueOptions: { size: -1 },
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
            tasksQueueOptions: { size: 0.2 },
          }
        )
    ).toThrow(
      new TypeError('Invalid worker node tasks queue size: must be an integer')
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { tasksStealingRatio: '' },
          }
        )
    ).toThrow(
      new TypeError(
        'Invalid worker node tasks stealing ratio: must be a number'
      )
    )
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            enableTasksQueue: true,
            tasksQueueOptions: { tasksStealingRatio: 1.1 },
          }
        )
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks stealing ratio: must be between 0 and 1'
      )
    )
  })

  it('Verify that pool worker choice strategy options can be set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
    )
    expect(pool.opts.workerChoiceStrategyOptions).toBeUndefined()
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        elu: { median: false },
        runTime: { median: false },
        waitTime: { median: false },
        weights: expect.objectContaining({
          0: expect.any(Number),
          [pool.info.maxSize - 1]: expect.any(Number),
        }),
      })
    }
    expect(
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      elu: {
        aggregate: true,
        average: true,
        median: false,
      },
      runTime: {
        aggregate: true,
        average: true,
        median: false,
      },
      waitTime: {
        aggregate: true,
        average: true,
        median: false,
      },
    })
    pool.setWorkerChoiceStrategyOptions({
      elu: { median: true },
      runTime: { median: true },
    })
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      elu: { median: true },
      runTime: { median: true },
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        elu: { median: true },
        runTime: { median: true },
        waitTime: { median: false },
        weights: expect.objectContaining({
          0: expect.any(Number),
          [pool.info.maxSize - 1]: expect.any(Number),
        }),
      })
    }
    expect(
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      elu: {
        aggregate: true,
        average: false,
        median: true,
      },
      runTime: {
        aggregate: true,
        average: false,
        median: true,
      },
      waitTime: {
        aggregate: true,
        average: true,
        median: false,
      },
    })
    pool.setWorkerChoiceStrategyOptions({
      elu: { median: false },
      runTime: { median: false },
    })
    expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
      elu: { median: false },
      runTime: { median: false },
    })
    for (const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
      .workerChoiceStrategies) {
      expect(workerChoiceStrategy.opts).toStrictEqual({
        elu: { median: false },
        runTime: { median: false },
        waitTime: { median: false },
        weights: expect.objectContaining({
          0: expect.any(Number),
          [pool.info.maxSize - 1]: expect.any(Number),
        }),
      })
    }
    expect(
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      elu: {
        aggregate: true,
        average: true,
        median: false,
      },
      runTime: {
        aggregate: true,
        average: true,
        median: false,
      },
      waitTime: {
        aggregate: true,
        average: true,
        median: false,
      },
    })
    expect(() =>
      pool.setWorkerChoiceStrategyOptions('invalidWorkerChoiceStrategyOptions')
    ).toThrow(
      new TypeError(
        'Invalid worker choice strategy options: must be a plain object'
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
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
    })
    pool.enableTasksQueue(true, { concurrency: 2 })
    expect(pool.opts.enableTasksQueue).toBe(true)
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      concurrency: 2,
      size: Math.pow(numberOfWorkers, 2),
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
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
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
    })
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueueBackPressureSize).toBe(
        pool.opts.tasksQueueOptions.size
      )
    }
    pool.setTasksQueueOptions({
      concurrency: 2,
      size: 2,
      tasksFinishedTimeout: 3000,
      tasksStealingOnBackPressure: false,
      tasksStealingRatio: 0.5,
      taskStealing: false,
    })
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      concurrency: 2,
      size: 2,
      tasksFinishedTimeout: 3000,
      tasksStealingOnBackPressure: false,
      tasksStealingRatio: 0.5,
      taskStealing: false,
    })
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueueBackPressureSize).toBe(
        pool.opts.tasksQueueOptions.size
      )
    }
    pool.setTasksQueueOptions({
      concurrency: 1,
      tasksStealingOnBackPressure: true,
      taskStealing: true,
    })
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      concurrency: 1,
      size: 2,
      tasksFinishedTimeout: 3000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.5,
      taskStealing: true,
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
    expect(() => pool.setTasksQueueOptions({ tasksStealingRatio: '' })).toThrow(
      new TypeError(
        'Invalid worker node tasks stealing ratio: must be a number'
      )
    )
    expect(() =>
      pool.setTasksQueueOptions({ tasksStealingRatio: 1.1 })
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks stealing ratio: must be between 0 and 1'
      )
    )
    await pool.destroy()
  })

  it('Verify that pool info is set', async () => {
    let pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.info).toStrictEqual({
      busyWorkerNodes: 0,
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      executedTasks: 0,
      executingTasks: 0,
      failedTasks: 0,
      idleWorkerNodes: numberOfWorkers,
      maxSize: numberOfWorkers,
      minSize: numberOfWorkers,
      ready: true,
      started: true,
      strategyRetries: 0,
      type: PoolTypes.fixed,
      version,
      worker: WorkerTypes.thread,
      workerNodes: numberOfWorkers,
    })
    await pool.destroy()
    pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    expect(pool.info).toStrictEqual({
      busyWorkerNodes: 0,
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      dynamicWorkerNodes: 0,
      executedTasks: 0,
      executingTasks: 0,
      failedTasks: 0,
      idleWorkerNodes: Math.floor(numberOfWorkers / 2),
      maxSize: numberOfWorkers,
      minSize: Math.floor(numberOfWorkers / 2),
      ready: true,
      started: true,
      strategyRetries: 0,
      type: PoolTypes.dynamic,
      version,
      worker: WorkerTypes.cluster,
      workerNodes: Math.floor(numberOfWorkers / 2),
    })
    await pool.destroy()
  })

  it('Verify that pool worker tasks usage are initialized', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.usage).toStrictEqual({
        elu: {
          active: {
            history: expect.any(CircularBuffer),
          },
          idle: {
            history: expect.any(CircularBuffer),
          },
        },
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: 0,
          executing: 0,
          failed: 0,
          maxQueued: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
    }
    await pool.destroy()
  })

  it('Verify that pool worker tasks queue are initialized', async () => {
    let pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.tasksQueue).toBeInstanceOf(PriorityQueue)
      expect(workerNode.tasksQueue.size).toBe(0)
      expect(workerNode.tasksQueue.maxSize).toBe(0)
      expect(workerNode.tasksQueue.bucketSize).toBe(defaultBucketSize)
      expect(workerNode.tasksQueue.enablePriority).toBe(false)
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.tasksQueue).toBeInstanceOf(PriorityQueue)
      expect(workerNode.tasksQueue.size).toBe(0)
      expect(workerNode.tasksQueue.maxSize).toBe(0)
      expect(workerNode.tasksQueue.bucketSize).toBe(defaultBucketSize)
      expect(workerNode.tasksQueue.enablePriority).toBe(false)
    }
    await pool.destroy()
  })

  it('Verify that pool worker info are initialized', async () => {
    let pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.info).toStrictEqual({
        backPressure: false,
        backPressureStealing: false,
        continuousStealing: false,
        dynamic: false,
        id: expect.any(Number),
        ready: true,
        stealing: false,
        stolen: false,
        type: WorkerTypes.cluster,
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
        backPressure: false,
        backPressureStealing: false,
        continuousStealing: false,
        dynamic: false,
        id: expect.any(Number),
        ready: true,
        stealing: false,
        stolen: false,
        type: WorkerTypes.thread,
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
      './tests/worker-files/cluster/testWorker.cjs',
      {
        startWorkers: false,
      }
    )
    expect(pool.info.started).toBe(false)
    expect(pool.info.ready).toBe(false)
    expect(pool.workerNodes).toStrictEqual([])
    expect(pool.readyEventEmitted).toBe(false)
    expect(pool.busyEventEmitted).toBe(false)
    expect(pool.backPressureEventEmitted).toBe(false)
    pool.start()
    expect(pool.info.started).toBe(true)
    expect(pool.info.ready).toBe(true)
    await waitPoolEvents(pool, PoolEvents.ready, 1)
    expect(pool.readyEventEmitted).toBe(true)
    expect(pool.busyEventEmitted).toBe(false)
    expect(pool.backPressureEventEmitted).toBe(false)
    expect(pool.workerNodes.length).toBe(numberOfWorkers)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
    }
    await pool.destroy()
  })

  it('Verify that pool execute() arguments are checked', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
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
    await expect(pool.execute(undefined, 'unknown')).rejects.toThrow(
      new Error("Task function 'unknown' not found")
    )
    await pool.destroy()
    await expect(pool.execute()).rejects.toThrow(
      new Error('Cannot execute a task on not started pool')
    )
  })

  it('Verify that pool worker tasks usage are computed', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        elu: {
          active: {
            history: expect.any(CircularBuffer),
          },
          idle: {
            history: expect.any(CircularBuffer),
          },
        },
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: 0,
          executing: maxMultiplier,
          failed: 0,
          maxQueued: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        elu: {
          active: {
            history: expect.any(CircularBuffer),
          },
          idle: {
            history: expect.any(CircularBuffer),
          },
        },
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          failed: 0,
          maxQueued: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
    }
    await pool.destroy()
  })

  it("Verify that pool worker tasks usage aren't reset at worker choice strategy change", async () => {
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
        elu: {
          active: {
            history: expect.any(CircularBuffer),
          },
          idle: {
            history: expect.any(CircularBuffer),
          },
        },
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          failed: 0,
          maxQueued: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        numberOfWorkers * maxMultiplier
      )
    }
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        elu: {
          active: {
            history: expect.any(CircularBuffer),
          },
          idle: {
            history: expect.any(CircularBuffer),
          },
        },
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          failed: 0,
          maxQueued: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        numberOfWorkers * maxMultiplier
      )
    }
    await pool.destroy()
  })

  it("Verify that pool event emitter 'ready' event can register a callback", async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
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
      busyWorkerNodes: 0,
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      dynamicWorkerNodes: 0,
      executedTasks: 0,
      executingTasks: 0,
      failedTasks: 0,
      idleWorkerNodes: Math.floor(numberOfWorkers / 2),
      maxSize: numberOfWorkers,
      minSize: Math.floor(numberOfWorkers / 2),
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.dynamic,
      version,
      worker: WorkerTypes.cluster,
      workerNodes: Math.floor(numberOfWorkers / 2),
    })
    await pool.destroy()
  })

  it("Verify that pool event emitter 'busy' and 'busyEnd' events can register a callback", async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolBusy = 0
    let poolBusyInfo
    pool.emitter.on(PoolEvents.busy, info => {
      ++poolBusy
      poolBusyInfo = info
    })
    let poolBusyEnd = 0
    let poolBusyEndInfo
    pool.emitter.on(PoolEvents.busyEnd, info => {
      ++poolBusyEnd
      poolBusyEndInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.busy,
      PoolEvents.busyEnd,
    ])
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    expect(poolBusy).toBe(1)
    expect(poolBusyInfo).toStrictEqual({
      busyWorkerNodes: numberOfWorkers,
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: 0,
      maxSize: numberOfWorkers,
      minSize: numberOfWorkers,
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.fixed,
      version,
      worker: WorkerTypes.thread,
      workerNodes: numberOfWorkers,
    })
    expect(poolBusyEnd).toBe(1)
    expect(poolBusyEndInfo).toStrictEqual({
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      maxSize: numberOfWorkers,
      minSize: numberOfWorkers,
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.fixed,
      version,
      worker: WorkerTypes.thread,
      workerNodes: numberOfWorkers,
    })
    expect(poolBusyEndInfo.busyWorkerNodes).toBeLessThan(numberOfWorkers)
    await pool.destroy()
  })

  it("Verify that pool event emitter 'full' and 'fullEnd' events can register a callback", async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolFull = 0
    let poolFullInfo
    pool.emitter.on(PoolEvents.full, info => {
      ++poolFull
      poolFullInfo = info
    })
    let poolFullEnd = 0
    let poolFullEndInfo
    pool.emitter.on(PoolEvents.fullEnd, info => {
      ++poolFullEnd
      poolFullEndInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.full,
      PoolEvents.fullEnd,
    ])
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    expect(poolFull).toBe(1)
    expect(poolFullInfo).toStrictEqual({
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      dynamicWorkerNodes: Math.floor(numberOfWorkers / 2),
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      maxSize: numberOfWorkers,
      minSize: Math.floor(numberOfWorkers / 2),
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.dynamic,
      version,
      worker: WorkerTypes.cluster,
      workerNodes: numberOfWorkers,
    })
    await waitPoolEvents(pool, PoolEvents.fullEnd, 1)
    expect(poolFullEnd).toBe(1)
    expect(poolFullEndInfo).toStrictEqual({
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      dynamicWorkerNodes: 0,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      maxSize: numberOfWorkers,
      minSize: Math.floor(numberOfWorkers / 2),
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.dynamic,
      version,
      worker: WorkerTypes.cluster,
      workerNodes: Math.floor(numberOfWorkers / 2),
    })
    await pool.destroy()
  })

  it("Verify that pool event emitter 'backPressure' and 'backPressureEnd' events can register a callback", async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
      {
        enableTasksQueue: true,
      }
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolBackPressure = 0
    let poolBackPressureInfo
    pool.emitter.on(PoolEvents.backPressure, info => {
      ++poolBackPressure
      poolBackPressureInfo = info
    })
    let poolBackPressureEnd = 0
    let poolBackPressureEndInfo
    pool.emitter.on(PoolEvents.backPressureEnd, info => {
      ++poolBackPressureEnd
      poolBackPressureEndInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.backPressure,
      PoolEvents.backPressureEnd,
    ])
    for (let i = 0; i < numberOfWorkers * 10; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    expect(poolBackPressure).toBe(1)
    expect(poolBackPressureInfo).toStrictEqual({
      backPressure: true,
      backPressureWorkerNodes: numberOfWorkers,
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      maxQueuedTasks: expect.any(Number),
      maxSize: numberOfWorkers,
      minSize: numberOfWorkers,
      queuedTasks: expect.any(Number),
      ready: true,
      started: true,
      stealingWorkerNodes: expect.any(Number),
      stolenTasks: expect.any(Number),
      strategyRetries: expect.any(Number),
      type: PoolTypes.fixed,
      version,
      worker: WorkerTypes.thread,
      workerNodes: numberOfWorkers,
    })
    expect(poolBackPressureEnd).toBe(1)
    expect(poolBackPressureEndInfo).toStrictEqual({
      backPressure: false,
      backPressureWorkerNodes: expect.any(Number),
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      maxQueuedTasks: expect.any(Number),
      maxSize: numberOfWorkers,
      minSize: numberOfWorkers,
      queuedTasks: expect.any(Number),
      ready: true,
      started: true,
      stealingWorkerNodes: expect.any(Number),
      stolenTasks: expect.any(Number),
      strategyRetries: expect.any(Number),
      type: PoolTypes.fixed,
      version,
      worker: WorkerTypes.thread,
      workerNodes: numberOfWorkers,
    })
    expect(poolBackPressureEndInfo.backPressureWorkerNodes).toBeLessThan(
      numberOfWorkers
    )
    await pool.destroy()
  })

  it("Verify that pool event emitter 'empty' event can register a callback", async () => {
    const pool = new DynamicClusterPool(
      0,
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolEmpty = 0
    let poolInfo
    pool.emitter.on(PoolEvents.empty, info => {
      ++poolEmpty
      poolInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.empty])
    for (let i = 0; i < numberOfWorkers; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    await waitPoolEvents(pool, PoolEvents.empty, 1)
    expect(poolEmpty).toBe(1)
    expect(poolInfo).toStrictEqual({
      busyWorkerNodes: 0,
      defaultStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      dynamicWorkerNodes: 0,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: 0,
      maxSize: numberOfWorkers,
      minSize: 0,
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.dynamic,
      version,
      worker: WorkerTypes.cluster,
      workerNodes: 0,
    })
    await pool.destroy()
  })

  it('Verify that destroy() waits for queued tasks to finish', async () => {
    const tasksFinishedTimeout = 2500
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/asyncWorker.mjs',
      {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout },
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
    expect(tasksFinished).toBeLessThanOrEqual(numberOfWorkers * maxMultiplier)
    expect(elapsedTime).toBeGreaterThanOrEqual(2000)
    expect(elapsedTime).toBeLessThanOrEqual(tasksFinishedTimeout + 800)
  })

  it('Verify that destroy() waits until the tasks finished timeout is reached', async () => {
    const tasksFinishedTimeout = 1000
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/asyncWorker.mjs',
      {
        enableTasksQueue: true,
        tasksQueueOptions: { tasksFinishedTimeout },
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
    expect(elapsedTime).toBeLessThanOrEqual(tasksFinishedTimeout + 800)
  })

  it('Verify that pool asynchronous resource track tasks execution', async () => {
    let taskAsyncId
    let initCalls = 0
    let beforeCalls = 0
    let afterCalls = 0
    let resolveCalls = 0
    const hook = createHook({
      after (asyncId) {
        if (asyncId === taskAsyncId) afterCalls++
      },
      before (asyncId) {
        if (asyncId === taskAsyncId) beforeCalls++
      },
      init (asyncId, type) {
        if (type === 'poolifier:task') {
          initCalls++
          taskAsyncId = asyncId
        }
      },
      promiseResolve () {
        if (executionAsyncId() === taskAsyncId) resolveCalls++
      },
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
      './tests/worker-files/cluster/testMultipleTaskFunctionsWorker.cjs'
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
      new TypeError('taskFunction property must be a function')
    )
    await expect(dynamicThreadPool.addTaskFunction('test', '')).rejects.toThrow(
      new TypeError('taskFunction property must be a function')
    )
    await expect(
      dynamicThreadPool.addTaskFunction('test', { taskFunction: 0 })
    ).rejects.toThrow(new TypeError('taskFunction property must be a function'))
    await expect(
      dynamicThreadPool.addTaskFunction('test', { taskFunction: '' })
    ).rejects.toThrow(new TypeError('taskFunction property must be a function'))
    await expect(
      dynamicThreadPool.addTaskFunction('test', {
        priority: -21,
        taskFunction: () => {},
      })
    ).rejects.toThrow(
      new RangeError("Property 'priority' must be between -20 and 19")
    )
    await expect(
      dynamicThreadPool.addTaskFunction('test', {
        priority: 20,
        taskFunction: () => {},
      })
    ).rejects.toThrow(
      new RangeError("Property 'priority' must be between -20 and 19")
    )
    await expect(
      dynamicThreadPool.addTaskFunction('test', {
        strategy: 'invalidStrategy',
        taskFunction: () => {},
      })
    ).rejects.toThrow(
      new Error("Invalid worker choice strategy 'invalidStrategy'")
    )
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
    ])
    expect([
      ...dynamicThreadPool.workerChoiceStrategiesContext.workerChoiceStrategies.keys(),
    ]).toStrictEqual([WorkerChoiceStrategies.ROUND_ROBIN])
    const echoTaskFunction = data => {
      return data
    }
    await expect(
      dynamicThreadPool.addTaskFunction('echo', {
        strategy: WorkerChoiceStrategies.LEAST_ELU,
        taskFunction: echoTaskFunction,
      })
    ).resolves.toBe(true)
    expect(dynamicThreadPool.taskFunctions.size).toBe(1)
    expect(dynamicThreadPool.taskFunctions.get('echo')).toStrictEqual({
      strategy: WorkerChoiceStrategies.LEAST_ELU,
      taskFunction: echoTaskFunction,
    })
    expect([
      ...dynamicThreadPool.workerChoiceStrategiesContext.workerChoiceStrategies.keys(),
    ]).toStrictEqual([
      WorkerChoiceStrategies.ROUND_ROBIN,
      WorkerChoiceStrategies.LEAST_ELU,
    ])
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
      { name: 'echo', strategy: WorkerChoiceStrategies.LEAST_ELU },
    ])
    const taskFunctionData = { test: 'test' }
    const echoResult = await dynamicThreadPool.execute(taskFunctionData, 'echo')
    expect(echoResult).toStrictEqual(taskFunctionData)
    for (const workerNode of dynamicThreadPool.workerNodes) {
      expect(workerNode.getTaskFunctionWorkerUsage('echo')).toStrictEqual({
        elu: expect.objectContaining({
          active: expect.objectContaining({
            history: expect.any(CircularBuffer),
          }),
          idle: expect.objectContaining({
            history: expect.any(CircularBuffer),
          }),
        }),
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          failed: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
      expect(
        workerNode.getTaskFunctionWorkerUsage('echo').tasks.executed
      ).toBeGreaterThan(0)
      if (
        workerNode.getTaskFunctionWorkerUsage('echo').elu.active.aggregate ==
        null
      ) {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.active.aggregate
        ).toBeUndefined()
      } else {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.active.aggregate
        ).toBeGreaterThan(0)
      }
      if (
        workerNode.getTaskFunctionWorkerUsage('echo').elu.idle.aggregate == null
      ) {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.idle.aggregate
        ).toBeUndefined()
      } else {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.idle.aggregate
        ).toBeGreaterThanOrEqual(0)
      }
      if (
        workerNode.getTaskFunctionWorkerUsage('echo').elu.utilization == null
      ) {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.utilization
        ).toBeUndefined()
      } else {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.utilization
        ).toBeGreaterThanOrEqual(0)
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.utilization
        ).toBeLessThanOrEqual(1)
      }
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
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
    ])
    await expect(dynamicThreadPool.removeTaskFunction('test')).rejects.toThrow(
      new Error('Cannot remove a task function not handled on the pool side')
    )
    const echoTaskFunction = data => {
      return data
    }
    await dynamicThreadPool.addTaskFunction('echo', {
      strategy: WorkerChoiceStrategies.LEAST_ELU,
      taskFunction: echoTaskFunction,
    })
    expect(dynamicThreadPool.taskFunctions.size).toBe(1)
    expect(dynamicThreadPool.taskFunctions.get('echo')).toStrictEqual({
      strategy: WorkerChoiceStrategies.LEAST_ELU,
      taskFunction: echoTaskFunction,
    })
    expect([
      ...dynamicThreadPool.workerChoiceStrategiesContext.workerChoiceStrategies.keys(),
    ]).toStrictEqual([
      WorkerChoiceStrategies.ROUND_ROBIN,
      WorkerChoiceStrategies.LEAST_ELU,
    ])
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
      { name: 'echo', strategy: WorkerChoiceStrategies.LEAST_ELU },
    ])
    await expect(dynamicThreadPool.removeTaskFunction('echo')).resolves.toBe(
      true
    )
    expect(dynamicThreadPool.taskFunctions.size).toBe(0)
    expect(dynamicThreadPool.taskFunctions.get('echo')).toBeUndefined()
    expect([
      ...dynamicThreadPool.workerChoiceStrategiesContext.workerChoiceStrategies.keys(),
    ]).toStrictEqual([WorkerChoiceStrategies.ROUND_ROBIN])
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
    ])
    await dynamicThreadPool.destroy()
  })

  it('Verify that listTaskFunctionsProperties() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'factorial' },
      { name: 'fibonacci' },
      { name: 'jsonIntegerSerialization' },
    ])
    await dynamicThreadPool.destroy()
    const fixedClusterPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testMultipleTaskFunctionsWorker.cjs'
    )
    await waitPoolEvents(fixedClusterPool, PoolEvents.ready, 1)
    expect(fixedClusterPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'factorial' },
      { name: 'fibonacci' },
      { name: 'jsonIntegerSerialization' },
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
        `Task function operation 'default' failed on worker ${workerId} with error: 'name parameter is not a string'`
      )
    )
    await expect(
      dynamicThreadPool.setDefaultTaskFunction(DEFAULT_TASK_NAME)
    ).rejects.toThrow(
      new Error(
        `Task function operation 'default' failed on worker ${workerId} with error: 'Cannot set the default task function reserved name as the default task function'`
      )
    )
    await expect(
      dynamicThreadPool.setDefaultTaskFunction('unknown')
    ).rejects.toThrow(
      new Error(
        `Task function operation 'default' failed on worker ${workerId} with error: 'Cannot set the default task function to a non-existing task function'`
      )
    )
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'factorial' },
      { name: 'fibonacci' },
      { name: 'jsonIntegerSerialization' },
    ])
    await expect(
      dynamicThreadPool.setDefaultTaskFunction('factorial')
    ).resolves.toBe(true)
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'factorial' },
      { name: 'fibonacci' },
      { name: 'jsonIntegerSerialization' },
    ])
    await expect(
      dynamicThreadPool.setDefaultTaskFunction('fibonacci')
    ).resolves.toBe(true)
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'fibonacci' },
      { name: 'factorial' },
      { name: 'jsonIntegerSerialization' },
    ])
    await dynamicThreadPool.destroy()
  })

  it('Verify that multiple task functions worker is working', async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testMultipleTaskFunctionsWorker.cjs'
    )
    const data = { n: 10 }
    const result0 = await pool.execute(data)
    expect(result0).toStrictEqual(3628800)
    const result1 = await pool.execute(data, 'jsonIntegerSerialization')
    expect(result1).toStrictEqual({ ok: 1 })
    const result2 = await pool.execute(data, 'factorial')
    expect(result2).toBe(3628800)
    const result3 = await pool.execute(data, 'fibonacci')
    expect(result3).toBe(55)
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(4)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.info.taskFunctionsProperties).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'factorial' },
        { name: 'fibonacci' },
        { name: 'jsonIntegerSerialization' },
      ])
      expect(workerNode.taskFunctionsUsage.size).toBe(3)
      expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.tasksQueue.enablePriority).toBe(false)
      for (const taskFunctionProperties of pool.listTaskFunctionsProperties()) {
        expect(
          workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name)
        ).toStrictEqual({
          elu: {
            active: {
              history: expect.any(CircularBuffer),
            },
            idle: {
              history: expect.any(CircularBuffer),
            },
          },
          runTime: {
            history: expect.any(CircularBuffer),
          },
          tasks: {
            executed: expect.any(Number),
            executing: 0,
            failed: 0,
            queued: 0,
            sequentiallyStolen: 0,
            stolen: 0,
          },
          waitTime: {
            history: expect.any(CircularBuffer),
          },
        })
        expect(
          workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name)
            .tasks.executed
        ).toBeGreaterThan(0)
      }
      expect(
        workerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME)
      ).toStrictEqual(
        workerNode.getTaskFunctionWorkerUsage(
          workerNode.info.taskFunctionsProperties[1].name
        )
      )
    }
    await pool.destroy()
  })

  it('Verify that mapExecute() is working', async () => {
    const pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await expect(pool.mapExecute()).rejects.toThrow(
      new TypeError('data argument must be a defined iterable')
    )
    await expect(pool.mapExecute(0)).rejects.toThrow(
      new TypeError('data argument must be an iterable')
    )
    await expect(pool.mapExecute([undefined], 0)).rejects.toThrow(
      new TypeError('name argument must be a string')
    )
    await expect(pool.mapExecute([undefined], '')).rejects.toThrow(
      new TypeError('name argument must not be an empty string')
    )
    await expect(pool.mapExecute([undefined], undefined, {})).rejects.toThrow(
      new TypeError('transferList argument must be an array')
    )
    await expect(pool.mapExecute([undefined], 'unknown')).rejects.toThrow(
      new Error("Task function 'unknown' not found")
    )
    let results = await pool.mapExecute(
      [{}, {}, {}, {}],
      'jsonIntegerSerialization'
    )
    expect(results).toStrictEqual([{ ok: 1 }, { ok: 1 }, { ok: 1 }, { ok: 1 }])
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(4)
    results = await pool.mapExecute(
      [{ n: 10 }, { n: 20 }, { n: 30 }, { n: 40 }],
      'factorial'
    )
    expect(results).toStrictEqual([
      3628800, 2432902008176640000, 2.6525285981219103e32, 8.159152832478977e47,
    ])
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(8)
    results = await pool.mapExecute(
      new Set([{ n: 10 }, { n: 20 }, { n: 30 }, { n: 40 }]),
      'factorial'
    )
    expect(results).toStrictEqual([
      3628800, 2432902008176640000, 2.6525285981219103e32, 8.159152832478977e47,
    ])
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(12)
    await pool.destroy()
    await expect(pool.mapExecute()).rejects.toThrow(
      new Error('Cannot execute task(s) on not started pool')
    )
  })

  it('Verify that task function objects worker is working', async () => {
    const pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testTaskFunctionObjectsWorker.mjs'
    )
    const data = { n: 10 }
    const result0 = await pool.execute(data)
    expect(result0).toStrictEqual(3628800)
    const result1 = await pool.execute(data, 'jsonIntegerSerialization')
    expect(result1).toStrictEqual({ ok: 1 })
    const result2 = await pool.execute(data, 'factorial')
    expect(result2).toBe(3628800)
    const result3 = await pool.execute(data, 'fibonacci')
    expect(result3).toBe(55)
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(4)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.info.taskFunctionsProperties).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'factorial' },
        { name: 'fibonacci', priority: -5 },
        { name: 'jsonIntegerSerialization' },
      ])
      expect(workerNode.taskFunctionsUsage.size).toBe(3)
      expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.tasksQueue.enablePriority).toBe(true)
      for (const taskFunctionProperties of pool.listTaskFunctionsProperties()) {
        expect(
          workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name)
        ).toStrictEqual({
          elu: {
            active: {
              history: expect.any(CircularBuffer),
            },
            idle: {
              history: expect.any(CircularBuffer),
            },
          },
          runTime: {
            history: expect.any(CircularBuffer),
          },
          tasks: {
            executed: expect.any(Number),
            executing: 0,
            failed: 0,
            queued: 0,
            sequentiallyStolen: 0,
            stolen: 0,
          },
          waitTime: {
            history: expect.any(CircularBuffer),
          },
        })
        expect(
          workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name)
            .tasks.executed
        ).toBeGreaterThan(0)
      }
      expect(
        workerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME)
      ).toStrictEqual(
        workerNode.getTaskFunctionWorkerUsage(
          workerNode.info.taskFunctionsProperties[1].name
        )
      )
    }
    await pool.destroy()
  })

  it('Verify sendKillMessageToWorker()', async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    const workerNodeKey = 0
    await expect(
      pool.sendKillMessageToWorker(workerNodeKey)
    ).resolves.toBeUndefined()
    await pool.destroy()
  })

  it('Verify sendTaskFunctionOperationToWorker()', async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    const workerNodeKey = 0
    await expect(
      pool.sendTaskFunctionOperationToWorker(workerNodeKey, {
        taskFunction: (() => {}).toString(),
        taskFunctionOperation: 'add',
        taskFunctionProperties: { name: 'empty' },
      })
    ).resolves.toBe(true)
    expect(
      pool.workerNodes[workerNodeKey].info.taskFunctionsProperties
    ).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
      { name: 'empty' },
    ])
    await pool.destroy()
  })

  it('Verify sendTaskFunctionOperationToWorkers()', async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    await expect(
      pool.sendTaskFunctionOperationToWorkers({
        taskFunction: (() => {}).toString(),
        taskFunctionOperation: 'add',
        taskFunctionProperties: { name: 'empty' },
      })
    ).resolves.toBe(true)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.info.taskFunctionsProperties).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'test' },
        { name: 'empty' },
      ])
    }
    await pool.destroy()
  })
})
