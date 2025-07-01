import { expect } from '@std/expect'
import { Worker as ClusterWorker } from 'node:cluster'
import { Worker as ThreadWorker } from 'node:worker_threads'

import { CircularBuffer } from '../../lib/circular-buffer.cjs'
import { WorkerTypes } from '../../lib/index.cjs'
import {
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
      concurrency: 1,
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
})
