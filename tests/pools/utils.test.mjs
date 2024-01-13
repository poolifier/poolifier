import { Worker as ThreadWorker } from 'node:worker_threads'
import cluster, { Worker as ClusterWorker } from 'node:cluster'
import { expect } from 'expect'
import {
  CircularArray,
  DEFAULT_CIRCULAR_ARRAY_SIZE
} from '../../lib/circular-array.cjs'
import {
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  buildWorkerChoiceStrategyOptions,
  createWorker,
  getDefaultTasksQueueOptions,
  getWorkerChoiceStrategyRetries,
  getWorkerId,
  getWorkerType,
  updateMeasurementStatistics
} from '../../lib/pools/utils.cjs'
import {
  FixedClusterPool,
  FixedThreadPool,
  WorkerTypes
} from '../../lib/index.cjs'

describe('Pool utils test suite', () => {
  it('Verify DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS values', () => {
    expect(DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS).toStrictEqual({
      aggregate: false,
      average: false,
      median: false
    })
  })

  it('Verify getDefaultTasksQueueOptions() behavior', () => {
    const poolMaxSize = 4
    expect(getDefaultTasksQueueOptions(poolMaxSize)).toStrictEqual({
      concurrency: 1,
      size: Math.pow(poolMaxSize, 2),
      taskStealing: true,
      tasksStealingOnBackPressure: true,
      tasksFinishedTimeout: 2000
    })
  })

  it('Verify getWorkerChoiceStrategyRetries() behavior', async () => {
    const numberOfThreads = 4
    const pool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(getWorkerChoiceStrategyRetries(pool)).toBe(pool.info.maxSize * 2)
    const workerChoiceStrategyOptions = {
      runTime: { median: true },
      waitTime: { median: true },
      elu: { median: true },
      weights: {
        0: 100,
        1: 100
      }
    }
    expect(
      getWorkerChoiceStrategyRetries(pool, workerChoiceStrategyOptions)
    ).toBe(
      pool.info.maxSize +
        Object.keys(workerChoiceStrategyOptions.weights).length
    )
    await pool.destroy()
  })

  it('Verify buildWorkerChoiceStrategyOptions() behavior', async () => {
    const numberOfWorkers = 4
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    expect(buildWorkerChoiceStrategyOptions(pool)).toStrictEqual({
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false },
      weights: expect.objectContaining({
        0: expect.any(Number),
        [pool.info.maxSize - 1]: expect.any(Number)
      })
    })
    const workerChoiceStrategyOptions = {
      runTime: { median: true },
      waitTime: { median: true },
      elu: { median: true },
      weights: {
        0: 100,
        1: 100
      }
    }
    expect(
      buildWorkerChoiceStrategyOptions(pool, workerChoiceStrategyOptions)
    ).toStrictEqual(workerChoiceStrategyOptions)
    await pool.destroy()
  })

  it('Verify updateMeasurementStatistics() behavior', () => {
    const measurementStatistics = {
      history: new CircularArray()
    }
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.01
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.01,
      maximum: 0.01,
      minimum: 0.01,
      history: new CircularArray()
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.02
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.03,
      maximum: 0.02,
      minimum: 0.01,
      history: new CircularArray()
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.001
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.031,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.001,
      history: new CircularArray(DEFAULT_CIRCULAR_ARRAY_SIZE, 0.001)
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.003
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.034,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.002,
      history: new CircularArray(DEFAULT_CIRCULAR_ARRAY_SIZE, 0.001, 0.003)
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: true },
      0.006
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.04,
      maximum: 0.02,
      minimum: 0.001,
      median: 0.003,
      history: new CircularArray(
        DEFAULT_CIRCULAR_ARRAY_SIZE,
        0.001,
        0.003,
        0.006
      )
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.01
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.05,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.005,
      history: new CircularArray(
        DEFAULT_CIRCULAR_ARRAY_SIZE,
        0.001,
        0.003,
        0.006,
        0.01
      )
    })
  })

  it('Verify createWorker() behavior', () => {
    expect(
      createWorker(
        WorkerTypes.thread,
        './tests/worker-files/thread/testWorker.mjs',
        {}
      )
    ).toBeInstanceOf(ThreadWorker)
    expect(
      createWorker(
        WorkerTypes.cluster,
        './tests/worker-files/cluster/testWorker.mjs',
        {}
      )
    ).toBeInstanceOf(ClusterWorker)
  })

  it('Verify getWorkerType() behavior', () => {
    expect(
      getWorkerType(
        new ThreadWorker('./tests/worker-files/thread/testWorker.mjs')
      )
    ).toBe(WorkerTypes.thread)
    expect(getWorkerType(cluster.fork())).toBe(WorkerTypes.cluster)
  })

  it('Verify getWorkerId() behavior', () => {
    const threadWorker = new ThreadWorker(
      './tests/worker-files/thread/testWorker.mjs'
    )
    const clusterWorker = cluster.fork()
    expect(getWorkerId(threadWorker)).toBe(threadWorker.threadId)
    expect(getWorkerId(clusterWorker)).toBe(clusterWorker.id)
  })
})
