import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FixedClusterPool, FixedThreadPool } from '../../../lib/index.mjs'
import {
  buildWorkerChoiceStrategiesPolicy,
  buildWorkerChoiceStrategiesTaskStatisticsRequirements,
  buildWorkerChoiceStrategyOptions,
  getWorkerChoiceStrategiesRetries,
  toggleMedianMeasurementStatisticsRequirements,
} from '../../../lib/pools/selection-strategies/selection-strategies-helpers.mjs'

describe('Selection strategies helpers test suite', () => {
  it('Verify toggleMedianMeasurementStatisticsRequirements() behavior', () => {
    // average -> median when toggleMedian is true
    const toMedian = { aggregate: true, average: true, median: false }
    toggleMedianMeasurementStatisticsRequirements(toMedian, true)
    expect(toMedian).toStrictEqual({
      aggregate: true,
      average: false,
      median: true,
    })

    // median -> average when toggleMedian is false
    const toAverage = { aggregate: true, average: false, median: true }
    toggleMedianMeasurementStatisticsRequirements(toAverage, false)
    expect(toAverage).toStrictEqual({
      aggregate: true,
      average: true,
      median: false,
    })

    // no-op: average=true with toggleMedian=false
    const noOpAverage = { aggregate: true, average: true, median: false }
    toggleMedianMeasurementStatisticsRequirements(noOpAverage, false)
    expect(noOpAverage).toStrictEqual({
      aggregate: true,
      average: true,
      median: false,
    })

    // no-op: median=true with toggleMedian=true
    const noOpMedian = { aggregate: true, average: false, median: true }
    toggleMedianMeasurementStatisticsRequirements(noOpMedian, true)
    expect(noOpMedian).toStrictEqual({
      aggregate: true,
      average: false,
      median: true,
    })
  })

  it('Verify buildWorkerChoiceStrategiesPolicy() behavior', () => {
    expect(buildWorkerChoiceStrategiesPolicy(new Map())).toStrictEqual({
      dynamicWorkerReady: false,
      dynamicWorkerUsage: false,
    })

    const allTrueStrategy = {
      strategyPolicy: { dynamicWorkerReady: true, dynamicWorkerUsage: true },
    }
    const allFalseStrategy = {
      strategyPolicy: { dynamicWorkerReady: false, dynamicWorkerUsage: false },
    }
    const mixedStrategy = {
      strategyPolicy: { dynamicWorkerReady: true, dynamicWorkerUsage: false },
    }

    expect(
      buildWorkerChoiceStrategiesPolicy(
        new Map([['ROUND_ROBIN', allFalseStrategy]])
      )
    ).toStrictEqual({
      dynamicWorkerReady: false,
      dynamicWorkerUsage: false,
    })

    expect(
      buildWorkerChoiceStrategiesPolicy(
        new Map([['ROUND_ROBIN', allTrueStrategy]])
      )
    ).toStrictEqual({
      dynamicWorkerReady: true,
      dynamicWorkerUsage: true,
    })

    // OR-reduce across multiple strategies
    expect(
      buildWorkerChoiceStrategiesPolicy(
        new Map([
          ['LEAST_USED', allFalseStrategy],
          ['ROUND_ROBIN', mixedStrategy],
        ])
      )
    ).toStrictEqual({
      dynamicWorkerReady: true,
      dynamicWorkerUsage: false,
    })
  })

  it('Verify buildWorkerChoiceStrategiesTaskStatisticsRequirements() behavior', () => {
    const allFalse = { aggregate: false, average: false, median: false }
    const allTrue = { aggregate: true, average: true, median: true }

    expect(
      buildWorkerChoiceStrategiesTaskStatisticsRequirements(new Map())
    ).toStrictEqual({
      elu: allFalse,
      runTime: allFalse,
      waitTime: allFalse,
    })

    const allTrueStrategy = {
      taskStatisticsRequirements: {
        elu: allTrue,
        runTime: allTrue,
        waitTime: allTrue,
      },
    }
    expect(
      buildWorkerChoiceStrategiesTaskStatisticsRequirements(
        new Map([['ROUND_ROBIN', allTrueStrategy]])
      )
    ).toStrictEqual({
      elu: allTrue,
      runTime: allTrue,
      waitTime: allTrue,
    })

    // OR-reduce per field across multiple strategies
    const eluAggregateOnly = {
      taskStatisticsRequirements: {
        elu: { aggregate: true, average: false, median: false },
        runTime: allFalse,
        waitTime: allFalse,
      },
    }
    const runTimeMedianOnly = {
      taskStatisticsRequirements: {
        elu: allFalse,
        runTime: { aggregate: false, average: false, median: true },
        waitTime: allFalse,
      },
    }
    expect(
      buildWorkerChoiceStrategiesTaskStatisticsRequirements(
        new Map([
          ['LEAST_USED', runTimeMedianOnly],
          ['ROUND_ROBIN', eluAggregateOnly],
        ])
      )
    ).toStrictEqual({
      elu: { aggregate: true, average: false, median: false },
      runTime: { aggregate: false, average: false, median: true },
      waitTime: allFalse,
    })
  })

  describe('Pool-dependent helpers', () => {
    const numberOfWorkers = 4
    const numberOfThreads = 4
    let clusterFixedPool, threadFixedPool

    beforeAll(() => {
      clusterFixedPool = new FixedClusterPool(
        numberOfWorkers,
        './tests/worker-files/cluster/testWorker.cjs'
      )
      threadFixedPool = new FixedThreadPool(
        numberOfThreads,
        './tests/worker-files/thread/testWorker.mjs'
      )
    })

    afterAll(async () => {
      // Skip on CI to avoid afterAll hook timeout
      if (process.env.CI != null) return
      await clusterFixedPool.destroy()
      await threadFixedPool.destroy()
    })

    it('Verify buildWorkerChoiceStrategyOptions() behavior', () => {
      expect(buildWorkerChoiceStrategyOptions(clusterFixedPool)).toStrictEqual({
        elu: { median: false },
        runTime: { median: false },
        waitTime: { median: false },
        weights: expect.objectContaining({
          0: expect.any(Number),
          [clusterFixedPool.info.maxSize - 1]: expect.any(Number),
        }),
      })
      const workerChoiceStrategyOptions = {
        elu: { median: true },
        runTime: { median: true },
        waitTime: { median: true },
        weights: {
          0: 100,
          1: 100,
        },
      }
      expect(
        buildWorkerChoiceStrategyOptions(
          clusterFixedPool,
          workerChoiceStrategyOptions
        )
      ).toStrictEqual(workerChoiceStrategyOptions)
    })

    it('Verify getWorkerChoiceStrategiesRetries() behavior', () => {
      expect(getWorkerChoiceStrategiesRetries(threadFixedPool)).toBe(
        threadFixedPool.info.maxSize * 2
      )
      const workerChoiceStrategyOptions = {
        elu: { median: true },
        runTime: { median: true },
        waitTime: { median: true },
        weights: {
          0: 100,
          1: 100,
        },
      }
      expect(
        getWorkerChoiceStrategiesRetries(
          threadFixedPool,
          workerChoiceStrategyOptions
        )
      ).toBe(
        threadFixedPool.info.maxSize +
          Object.keys(workerChoiceStrategyOptions.weights).length
      )
    })
  })
})
