import { expect } from 'expect'

import { FixedClusterPool, FixedThreadPool } from '../../../lib/index.cjs'
import {
  buildWorkerChoiceStrategyOptions,
  getWorkerChoiceStrategiesRetries,
} from '../../../lib/pools/selection-strategies/selection-strategies-utils.cjs'

describe('Selection strategies utils test suite', () => {
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
        [pool.info.maxSize - 1]: expect.any(Number),
      }),
    })
    const workerChoiceStrategyOptions = {
      runTime: { median: true },
      waitTime: { median: true },
      elu: { median: true },
      weights: {
        0: 100,
        1: 100,
      },
    }
    expect(
      buildWorkerChoiceStrategyOptions(pool, workerChoiceStrategyOptions)
    ).toStrictEqual(workerChoiceStrategyOptions)
    await pool.destroy()
  })

  it('Verify getWorkerChoiceStrategyRetries() behavior', async () => {
    const numberOfThreads = 4
    const pool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(getWorkerChoiceStrategiesRetries(pool)).toBe(pool.info.maxSize * 2)
    const workerChoiceStrategyOptions = {
      runTime: { median: true },
      waitTime: { median: true },
      elu: { median: true },
      weights: {
        0: 100,
        1: 100,
      },
    }
    expect(
      getWorkerChoiceStrategiesRetries(pool, workerChoiceStrategyOptions)
    ).toBe(
      pool.info.maxSize +
        Object.keys(workerChoiceStrategyOptions.weights).length
    )
    await pool.destroy()
  })
})
