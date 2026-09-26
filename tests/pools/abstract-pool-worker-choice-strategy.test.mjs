import {
  describe,
  expect,
  FixedThreadPool,
  it,
  numberOfWorkers,
  WorkerChoiceStrategies,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
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
      pool.setWorkerChoiceStrategyOptions({
        measurement: 'invalidMeasurement',
      })
    ).toThrow(
      new Error(
        "Invalid worker choice strategy options: invalid measurement 'invalidMeasurement'"
      )
    )
    await pool.destroy()
  })
})
