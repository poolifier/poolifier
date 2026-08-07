import {
  CircularBuffer,
  defaultBucketSize,
  describe,
  DynamicClusterPool,
  DynamicThreadPool,
  expect,
  FixedClusterPool,
  FixedThreadPool,
  it,
  numberOfWorkers,
  PoolTypes,
  PriorityQueue,
  ready,
  version,
  WorkerChoiceStrategies,
  WorkerNode,
  WorkerTypes,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that pool info is set', async () => {
    let pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await ready(pool)
    expect(pool.info).toStrictEqual({
      busyWorkerNodes: 0,
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
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
    await ready(pool)
    expect(pool.info).toStrictEqual({
      busyWorkerNodes: 0,
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
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
    await ready(pool)
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
    await ready(pool)
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
    await ready(pool)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.info).toStrictEqual({
        backPressure: false,
        backPressureStealing: false,
        continuousStealing: false,
        crashHandled: false,
        dynamic: false,
        id: expect.any(Number),
        queuedTaskAbortion: false,
        ready: true,
        stealing: false,
        stolen: false,
        taskFunctionsProperties: [{ name: 'default' }, { name: 'test' }],
        terminating: false,
        type: WorkerTypes.cluster,
      })
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await ready(pool)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode).toBeInstanceOf(WorkerNode)
      expect(workerNode.info).toStrictEqual({
        backPressure: false,
        backPressureStealing: false,
        continuousStealing: false,
        crashHandled: false,
        dynamic: false,
        id: expect.any(Number),
        queuedTaskAbortion: false,
        ready: true,
        stealing: false,
        stolen: false,
        taskFunctionsProperties: [{ name: 'default' }, { name: 'test' }],
        terminating: false,
        type: WorkerTypes.thread,
      })
    }
    await pool.destroy()
  })
})
