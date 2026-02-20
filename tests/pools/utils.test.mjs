import { expect } from '@std/expect'
import { Worker as ClusterWorker } from 'node:cluster'
import { Worker as ThreadWorker } from 'node:worker_threads'

import { CircularBuffer } from '../../lib/circular-buffer.cjs'
import { WorkerTypes } from '../../lib/index.cjs'
import {
  checkValidWorkerNodeKeys,
  createWorker,
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  getDefaultTasksQueueOptions,
  initWorkerInfo,
  updateMeasurementStatistics,
} from '../../lib/pools/utils.cjs'
import { MeasurementHistorySize } from '../../lib/pools/worker.cjs'

describe('Pool utils test suite', () => {
  it('Verify DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS values', () => {
    expect(DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS).toStrictEqual({
      aggregate: false,
      average: false,
      median: false,
    })
  })

  it('Verify getDefaultTasksQueueOptions() behavior', () => {
    const poolMaxSize = 4
    expect(getDefaultTasksQueueOptions(poolMaxSize)).toStrictEqual({
      agingFactor: 0.001,
      concurrency: 1,
      loadExponent: 0.6666666666666666,
      size: poolMaxSize ** 2,
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
    })
  })

  it('Verify updateMeasurementStatistics() behavior', () => {
    const measurementStatistics = {
      history: new CircularBuffer(MeasurementHistorySize),
    }
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.01
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.01,
      maximum: 0.01,
      minimum: 0.01,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.02
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.03,
      maximum: 0.02,
      minimum: 0.01,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.001
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.031,
      average: 0.0010000000474974513,
      maximum: 0.02,
      minimum: 0.001,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.003
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.034,
      average: 0.0020000000367872417,
      maximum: 0.02,
      minimum: 0.001,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: true },
      0.006
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.04,
      maximum: 0.02,
      median: 0.003000000026077032,
      minimum: 0.001,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.01
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.05,
      average: 0.004999999975552782,
      maximum: 0.02,
      minimum: 0.001,
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

  it('Verify initWorkerInfo() behavior', () => {
    const threadWorker = createWorker(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {}
    )
    const threadWorkerInfo = initWorkerInfo(threadWorker)
    expect(threadWorkerInfo).toStrictEqual({
      backPressure: false,
      backPressureStealing: false,
      continuousStealing: false,
      dynamic: false,
      id: threadWorker.threadId,
      queuedTaskAbortion: false,
      ready: false,
      stealing: false,
      stolen: false,
      type: WorkerTypes.thread,
    })
    const clusterWorker = createWorker(
      WorkerTypes.cluster,
      './tests/worker-files/cluster/testWorker.mjs',
      {}
    )
    const clusterWorkerInfo = initWorkerInfo(clusterWorker)
    expect(clusterWorkerInfo).toMatchObject({
      backPressure: false,
      backPressureStealing: false,
      continuousStealing: false,
      dynamic: false,
      id: clusterWorker.id,
      queuedTaskAbortion: false,
      ready: false,
      stealing: false,
      stolen: false,
      type: WorkerTypes.cluster,
    })
  })

  it('Verify checkValidWorkerNodeKeys() behavior', () => {
    // Should not throw for undefined
    expect(() => checkValidWorkerNodeKeys(undefined)).not.toThrow()
    // Should not throw for null
    expect(() => checkValidWorkerNodeKeys(null)).not.toThrow()
    // Should not throw for valid array with elements
    expect(() => checkValidWorkerNodeKeys([0, 1, 2])).not.toThrow()
    // Should throw TypeError for non-array
    expect(() => checkValidWorkerNodeKeys('not an array')).toThrow(
      new TypeError('Invalid worker node keys: must be an array')
    )
    expect(() => checkValidWorkerNodeKeys(123)).toThrow(
      new TypeError('Invalid worker node keys: must be an array')
    )
    expect(() => checkValidWorkerNodeKeys({})).toThrow(
      new TypeError('Invalid worker node keys: must be an array')
    )
    // Should throw RangeError for empty array
    expect(() => checkValidWorkerNodeKeys([])).toThrow(
      new RangeError('Invalid worker node keys: must not be an empty array')
    )
    // Should throw TypeError for non-integer values
    expect(() => checkValidWorkerNodeKeys([1.5])).toThrow(
      new TypeError(
        "Invalid worker node key '1.5': must be a non-negative safe integer"
      )
    )
    expect(() => checkValidWorkerNodeKeys([0, 1.5, 2])).toThrow(
      new TypeError(
        "Invalid worker node key '1.5': must be a non-negative safe integer"
      )
    )
    // Should throw TypeError for negative values
    expect(() => checkValidWorkerNodeKeys([-1])).toThrow(
      new TypeError(
        "Invalid worker node key '-1': must be a non-negative safe integer"
      )
    )
    expect(() => checkValidWorkerNodeKeys([0, -1, 2])).toThrow(
      new TypeError(
        "Invalid worker node key '-1': must be a non-negative safe integer"
      )
    )
    // Should throw TypeError for NaN
    expect(() => checkValidWorkerNodeKeys([NaN])).toThrow(
      new TypeError(
        "Invalid worker node key 'NaN': must be a non-negative safe integer"
      )
    )
    // Should throw TypeError for Infinity
    expect(() => checkValidWorkerNodeKeys([Infinity])).toThrow(
      new TypeError(
        "Invalid worker node key 'Infinity': must be a non-negative safe integer"
      )
    )
    expect(() => checkValidWorkerNodeKeys([-Infinity])).toThrow(
      new TypeError(
        "Invalid worker node key '-Infinity': must be a non-negative safe integer"
      )
    )
    // Should throw TypeError for duplicate keys
    expect(() => checkValidWorkerNodeKeys([0, 0, 1])).toThrow(
      new TypeError('Invalid worker node keys: must not contain duplicates')
    )
    expect(() => checkValidWorkerNodeKeys([1, 2, 1])).toThrow(
      new TypeError('Invalid worker node keys: must not contain duplicates')
    )
    // Should not throw with maxPoolSize when keys are in range
    expect(() => checkValidWorkerNodeKeys([0, 1, 2], 4)).not.toThrow()
    // Should throw RangeError when keys exceed maxPoolSize count
    expect(() => checkValidWorkerNodeKeys([0, 1, 2, 3, 4], 4)).toThrow(
      new RangeError(
        'Cannot add a task function with more worker node keys than the maximum number of workers in the pool'
      )
    )
    // Should throw RangeError when a key is out of range
    expect(() => checkValidWorkerNodeKeys([0, 4], 4)).toThrow(
      new RangeError(
        'Cannot add a task function with invalid worker node keys: 4. Valid keys are: 0..3'
      )
    )
    expect(() => checkValidWorkerNodeKeys([999], 4)).toThrow(
      new RangeError(
        'Cannot add a task function with invalid worker node keys: 999. Valid keys are: 0..3'
      )
    )
  })
})
