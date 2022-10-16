const { expect } = require('expect')
const {
  WorkerChoiceStrategies,
  DynamicThreadPool,
  FixedThreadPool,
  FixedClusterPool
} = require('../../../lib/index')

describe('Selection strategies test suite', () => {
  const min = 0
  const max = 3

  it('Verify that WorkerChoiceStrategies enumeration provides string values', () => {
    expect(WorkerChoiceStrategies.ROUND_ROBIN).toBe('ROUND_ROBIN')
    expect(WorkerChoiceStrategies.LESS_RECENTLY_USED).toBe('LESS_RECENTLY_USED')
    expect(WorkerChoiceStrategies.FAIR_SHARE).toBe('FAIR_SHARE')
    expect(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN).toBe(
      'WEIGHTED_ROUND_ROBIN'
    )
  })

  it('Verify ROUND_ROBIN strategy is the default at pool creation', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy is taken at pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN }
    )
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy().nextWorkerIndex
    ).toBe(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy can be set after pool creation', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.ROUND_ROBIN)
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy default tasks usage statistics requirements', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .requiredStatistics.runTime
    ).toBe(false)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .requiredStatistics.runTime
    ).toBe(false)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN }
    )
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    // TODO: Create a better test to cover `RoundRobinWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN }
    )
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    // TODO: Create a better test to cover `RoundRobinWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy runtime behavior', async () => {
    let pool = new FixedClusterPool(
      max,
      './tests/worker-files/cluster/testWorker.js'
    )
    let results = new Set()
    for (let i = 0; i < max; i++) {
      results.add(pool.chooseWorker().id)
    }
    expect(results.size).toBe(max)
    await pool.destroy()
    pool = new FixedThreadPool(max, './tests/worker-files/thread/testWorker.js')
    results = new Set()
    for (let i = 0; i < max; i++) {
      results.add(pool.chooseWorker().threadId)
    }
    expect(results.size).toBe(max)
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy internals are resets after setting it', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy().nextWorkerIndex
    ).toBeUndefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy().nextWorkerIndex
    ).toBe(0)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workerChoiceStrategy.nextWorkerIndex
    ).toBeUndefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workerChoiceStrategy.nextWorkerIndex
    ).toBe(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_RECENTLY_USED strategy is taken at pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED }
    )
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_RECENTLY_USED strategy can be set after pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.LESS_RECENTLY_USED)
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_RECENTLY_USED strategy default tasks usage statistics requirements', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.LESS_RECENTLY_USED)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .requiredStatistics.runTime
    ).toBe(false)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.LESS_RECENTLY_USED)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .requiredStatistics.runTime
    ).toBe(false)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_RECENTLY_USED strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED }
    )
    // TODO: Create a better test to cover `LessRecentlyUsedWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_RECENTLY_USED strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED }
    )
    // TODO: Create a better test to cover `LessRecentlyUsedWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy is taken at pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
    )
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.FAIR_SHARE
    )
    for (const worker of pool.workerChoiceStrategyContext
      .getWorkerChoiceStrategy()
      .workerLastVirtualTaskTimestamp.keys()) {
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workerLastVirtualTaskTimestamp.get(worker).start
      ).toBe(0)
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workerLastVirtualTaskTimestamp.get(worker).end
      ).toBe(0)
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy can be set after pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.FAIR_SHARE
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy default tasks usage statistics requirements', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .requiredStatistics.runTime
    ).toBe(true)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .requiredStatistics.runTime
    ).toBe(true)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
    )
    // TODO: Create a better test to cover `FairShareChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
    )
    // TODO: Create a better test to cover `FairShareChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy internals are resets after setting it', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workerLastVirtualTaskTimestamp
    ).toBeUndefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    for (const worker of pool.workerChoiceStrategyContext
      .getWorkerChoiceStrategy()
      .workerLastVirtualTaskTimestamp.keys()) {
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workerLastVirtualTaskTimestamp.get(worker).start
      ).toBe(0)
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workerLastVirtualTaskTimestamp.get(worker).end
      ).toBe(0)
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workerChoiceStrategy.workerLastVirtualTaskTimestamp
    ).toBeUndefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    for (const worker of pool.workerChoiceStrategyContext
      .getWorkerChoiceStrategy()
      .workerChoiceStrategy.workerLastVirtualTaskTimestamp.keys()) {
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workerChoiceStrategy.workerLastVirtualTaskTimestamp.get(worker).start
      ).toBe(0)
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workerChoiceStrategy.workerLastVirtualTaskTimestamp.get(worker).end
      ).toBe(0)
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy is taken at pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    )
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .currentWorkerIndex
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .defaultWorkerWeight
    ).toBeGreaterThan(0)
    for (const worker of pool.workerChoiceStrategyContext
      .getWorkerChoiceStrategy()
      .workersTaskRunTime.keys()) {
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workersTaskRunTime.get(worker).weight
      ).toBeGreaterThan(0)
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workersTaskRunTime.get(worker).runTime
      ).toBe(0)
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy can be set after pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN)
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy default tasks usage statistics requirements', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .requiredStatistics.runTime
    ).toBe(true)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .requiredStatistics.runTime
    ).toBe(true)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    // TODO: Create a better test to cover `WeightedRoundRobinWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    // TODO: Create a better test to cover `WeightedRoundRobinWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy internals are resets after setting it', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .currentWorkerIndex
    ).toBeUndefined()
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .defaultWorkerWeight
    ).toBeUndefined()
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workersTaskRunTime
    ).toBeUndefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .currentWorkerIndex
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .defaultWorkerWeight
    ).toBeGreaterThan(0)
    for (const worker of pool.workerChoiceStrategyContext
      .getWorkerChoiceStrategy()
      .workersTaskRunTime.keys()) {
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workersTaskRunTime.get(worker).runTime
      ).toBe(0)
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workerChoiceStrategy.currentWorkerIndex
    ).toBeUndefined()
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workerChoiceStrategy.defaultWorkerWeight
    ).toBeUndefined()
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workerChoiceStrategy.workersTaskRunTime
    ).toBeUndefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workerChoiceStrategy.currentWorkerIndex
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.getWorkerChoiceStrategy()
        .workerChoiceStrategy.defaultWorkerWeight
    ).toBeGreaterThan(0)
    for (const worker of pool.workerChoiceStrategyContext
      .getWorkerChoiceStrategy()
      .workerChoiceStrategy.workersTaskRunTime.keys()) {
      expect(
        pool.workerChoiceStrategyContext
          .getWorkerChoiceStrategy()
          .workerChoiceStrategy.workersTaskRunTime.get(worker).runTime
      ).toBe(0)
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify unknown strategies throw error', () => {
    expect(
      () =>
        new DynamicThreadPool(
          min,
          max,
          './tests/worker-files/thread/testWorker.js',
          { workerChoiceStrategy: 'UNKNOWN_STRATEGY' }
        )
    ).toThrowError(
      new Error("Worker choice strategy 'UNKNOWN_STRATEGY' not found")
    )
  })
})
