import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FixedClusterPool, FixedThreadPool } from '../../../lib/index.mjs'
import {
  buildWorkerChoiceStrategyOptions,
  getWorkerChoiceStrategiesRetries,
} from '../../../lib/pools/selection-strategies/selection-strategies-helpers.mjs'

describe('Selection strategies utils test suite', () => {
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

  it('Verify buildWorkerChoiceStrategyOptions() behavior', async () => {
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

  it('Verify getWorkerChoiceStrategyRetries() behavior', async () => {
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
