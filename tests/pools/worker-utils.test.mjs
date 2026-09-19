import { Worker as ClusterWorker } from 'node:cluster'
import { Worker as ThreadWorker } from 'node:worker_threads'
import { describe, expect, it } from 'vitest'

import { CircularBuffer } from '../../lib/circular-buffer.mjs'
import { WorkerTypes } from '../../lib/index.mjs'
import {
  checkValidWorkerNodeKeys,
  createWorker,
  initWorkerInfo,
  updateEluWorkerUsage,
  updateMeasurementStatistics,
  updateRunTimeWorkerUsage,
} from '../../lib/pools/utils.mjs'
import { MeasurementHistorySize } from '../../lib/pools/worker.mjs'

describe('Pool worker utils test suite', () => {
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

  it('rejects a measurement atomically when its aggregate would overflow', () => {
    const measurementStatistics = {
      history: new CircularBuffer(MeasurementHistorySize),
    }
    const measurementValue = Number.MAX_VALUE / 2
    const measurementRequirements = {
      aggregate: true,
      average: false,
      median: false,
    }
    updateMeasurementStatistics(
      measurementStatistics,
      measurementRequirements,
      measurementValue
    )
    updateMeasurementStatistics(
      measurementStatistics,
      measurementRequirements,
      Number.MAX_VALUE
    )

    expect(measurementStatistics).toMatchObject({
      aggregate: measurementValue,
      maximum: measurementValue,
      minimum: measurementValue,
    })
    expect(measurementStatistics.history.toArray()).toStrictEqual([])
    expect(measurementStatistics.average).toBeUndefined()
    expect(measurementStatistics.median).toBeUndefined()
  })

  it('rejects a measurement atomically when required Float32 history would overflow', () => {
    const measurementStatistics = {
      history: new CircularBuffer(MeasurementHistorySize),
    }
    const measurementRequirements = {
      aggregate: true,
      average: true,
      median: true,
    }
    updateMeasurementStatistics(
      measurementStatistics,
      measurementRequirements,
      4
    )
    updateMeasurementStatistics(
      measurementStatistics,
      measurementRequirements,
      Number.MAX_VALUE
    )

    expect(measurementStatistics).toMatchObject({
      aggregate: 4,
      average: 4,
      maximum: 4,
      median: 4,
      minimum: 4,
    })
    expect(measurementStatistics.history.toArray()).toStrictEqual([4])
  })

  it('keeps same-sign ELU utilization averages finite without multiplying by count', () => {
    const workerChoiceStrategiesContext = {
      getTaskStatisticsRequirements: () => ({
        elu: { aggregate: true, average: false, median: false },
      }),
    }
    const workerUsage = {
      elu: {
        active: { history: new CircularBuffer(MeasurementHistorySize) },
        count: 1,
        idle: { history: new CircularBuffer(MeasurementHistorySize) },
        utilization: Number.MAX_VALUE,
      },
    }

    updateEluWorkerUsage(workerChoiceStrategiesContext, workerUsage, {
      taskPerformance: {
        elu: { active: 0, idle: 0, utilization: Number.MAX_VALUE },
      },
    })

    expect(workerUsage.elu).toMatchObject({
      count: 2,
      utilization: Number.MAX_VALUE,
    })
  })

  it('keeps opposite-sign ELU utilization averages finite without multiplying by count', () => {
    const workerChoiceStrategiesContext = {
      getTaskStatisticsRequirements: () => ({
        elu: { aggregate: true, average: false, median: false },
      }),
    }
    const workerUsage = {
      elu: {
        active: { history: new CircularBuffer(MeasurementHistorySize) },
        count: 2,
        idle: { history: new CircularBuffer(MeasurementHistorySize) },
        utilization: Number.MAX_VALUE,
      },
    }

    updateEluWorkerUsage(workerChoiceStrategiesContext, workerUsage, {
      taskPerformance: {
        elu: { active: 0, idle: 0, utilization: -Number.MAX_VALUE },
      },
    })

    expect(workerUsage.elu.count).toBe(3)
    expect(Number.isFinite(workerUsage.elu.utilization)).toBe(true)
    expect(workerUsage.elu.utilization / Number.MAX_VALUE).toBeCloseTo(1 / 3)
  })

  it('ignores ELU utilization when its accepted-observation count is exhausted', () => {
    const workerChoiceStrategiesContext = {
      getTaskStatisticsRequirements: () => ({
        elu: { aggregate: true, average: false, median: false },
      }),
    }
    const workerUsage = {
      elu: {
        active: { history: new CircularBuffer(MeasurementHistorySize) },
        count: Number.MAX_SAFE_INTEGER,
        idle: { history: new CircularBuffer(MeasurementHistorySize) },
        utilization: 0.25,
      },
    }

    updateEluWorkerUsage(workerChoiceStrategiesContext, workerUsage, {
      taskPerformance: {
        elu: { active: 0, idle: 0, utilization: 0.75 },
      },
    })

    expect(workerUsage.elu).toMatchObject({
      count: Number.MAX_SAFE_INTEGER,
      utilization: 0.25,
    })
  })

  it.each([NaN, Infinity, -Infinity])(
    'ignores non-finite task-performance measurements: %s',
    nonFiniteMeasurement => {
      const workerChoiceStrategiesContext = {
        getTaskStatisticsRequirements: () => ({
          elu: { aggregate: true, average: true, median: true },
          runTime: { aggregate: true, average: true, median: true },
        }),
      }
      const workerUsage = {
        elu: {
          active: { history: new CircularBuffer(MeasurementHistorySize) },
          idle: { history: new CircularBuffer(MeasurementHistorySize) },
        },
        runTime: { history: new CircularBuffer(MeasurementHistorySize) },
      }

      updateRunTimeWorkerUsage(workerChoiceStrategiesContext, workerUsage, {
        taskPerformance: { runTime: 0 },
      })
      updateRunTimeWorkerUsage(workerChoiceStrategiesContext, workerUsage, {
        taskPerformance: { runTime: 4 },
      })
      updateEluWorkerUsage(workerChoiceStrategiesContext, workerUsage, {
        taskPerformance: { elu: { active: 0, idle: 0, utilization: 0 } },
      })
      updateEluWorkerUsage(workerChoiceStrategiesContext, workerUsage, {
        taskPerformance: { elu: { active: 2, idle: 6, utilization: 0.5 } },
      })

      updateRunTimeWorkerUsage(workerChoiceStrategiesContext, workerUsage, {
        taskPerformance: { runTime: nonFiniteMeasurement },
      })
      updateEluWorkerUsage(workerChoiceStrategiesContext, workerUsage, {
        taskPerformance: {
          elu: {
            active: nonFiniteMeasurement,
            idle: nonFiniteMeasurement,
            utilization: nonFiniteMeasurement,
          },
        },
      })

      expect(workerUsage.runTime).toMatchObject({
        aggregate: 4,
        average: 2,
        maximum: 4,
        median: 2,
        minimum: 0,
      })
      expect(workerUsage.runTime.history.toArray()).toStrictEqual([0, 4])
      expect(workerUsage.elu.active).toMatchObject({
        aggregate: 2,
        average: 1,
        maximum: 2,
        median: 1,
        minimum: 0,
      })
      expect(workerUsage.elu.active.history.toArray()).toStrictEqual([0, 2])
      expect(workerUsage.elu.idle).toMatchObject({
        aggregate: 6,
        average: 3,
        maximum: 6,
        median: 3,
        minimum: 0,
      })
      expect(workerUsage.elu.idle.history.toArray()).toStrictEqual([0, 6])
      expect(workerUsage.elu).toMatchObject({ count: 2, utilization: 0.25 })
    }
  )

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
        './tests/worker-files/cluster/testWorker.cjs',
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
      crashHandled: false,
      dynamic: false,
      id: threadWorker.threadId,
      queuedTaskAbortion: false,
      ready: false,
      stealing: false,
      stolen: false,
      terminating: false,
      type: WorkerTypes.thread,
    })
    const clusterWorker = createWorker(
      WorkerTypes.cluster,
      './tests/worker-files/cluster/testWorker.cjs',
      {}
    )
    const clusterWorkerInfo = initWorkerInfo(clusterWorker)
    expect(clusterWorkerInfo).toMatchObject({
      backPressure: false,
      backPressureStealing: false,
      continuousStealing: false,
      crashHandled: false,
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
