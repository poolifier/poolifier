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
    expect(WorkerChoiceStrategies.LESS_USED).toBe('LESS_USED')
    expect(WorkerChoiceStrategies.LESS_BUSY).toBe('LESS_BUSY')
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
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeId
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
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy default tasks usage statistics requirements', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
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
      results.add(pool.chooseWorkerNode()[1].worker.id)
    }
    expect(results.size).toBe(max)
    await pool.destroy()
    pool = new FixedThreadPool(max, './tests/worker-files/thread/testWorker.js')
    results = new Set()
    for (let i = 0; i < max; i++) {
      results.add(pool.chooseWorkerNode()[1].worker.threadId)
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
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.ROUND_ROBIN
      ).nextWorkerNodeId
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeId
    ).toBe(0)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.ROUND_ROBIN
      ).nextWorkerNodeId
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeId
    ).toBe(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_USED strategy is taken at pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED }
    )
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_USED
    )
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_USED
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_USED strategy can be set after pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.LESS_USED)
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_USED
    )
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_USED
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_USED strategy default tasks usage statistics requirements', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_USED strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED }
    )
    // TODO: Create a better test to cover `LessUsedWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_USED strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED }
    )
    // TODO: Create a better test to cover `LessUsedWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_BUSY strategy is taken at pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_BUSY }
    )
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_BUSY
    )
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_BUSY
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_BUSY strategy can be set after pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.LESS_BUSY)
    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_BUSY
    )
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_BUSY
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_BUSY strategy default tasks usage statistics requirements', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_BUSY }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_BUSY }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(false)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_BUSY strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_BUSY }
    )
    // TODO: Create a better test to cover `LessBusyWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_BUSY strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_BUSY }
    )
    // TODO: Create a better test to cover `LessBusyWorkerChoiceStrategy#choose`
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
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.FAIR_SHARE
    )
    for (const workerNodeKey of pool.workerChoiceStrategyContext.workerChoiceStrategies
      .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
      .workerLastVirtualTaskTimestamp.keys()) {
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workerLastVirtualTaskTimestamp.get(workerNodeKey).start
      ).toBe(0)
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workerLastVirtualTaskTimestamp.get(workerNodeKey).end
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
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.FAIR_SHARE
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy default tasks usage statistics requirements', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
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
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerLastVirtualTaskTimestamp.size
    ).toBe(pool.workerNodes.length)
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
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // if (process.platform !== 'win32') {
    //   expect(
    //     pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
    //       pool.workerChoiceStrategyContext.workerChoiceStrategy
    //     ).workerLastVirtualTaskTimestamp.size
    //   ).toBe(pool.workerNodes.length)
    // }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy internals are resets after setting it', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.FAIR_SHARE
      ).workerLastVirtualTaskTimestamp
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    for (const workerNodeKey of pool.workerChoiceStrategyContext.workerChoiceStrategies
      .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
      .workerLastVirtualTaskTimestamp.keys()) {
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workerLastVirtualTaskTimestamp.get(workerNodeKey).start
      ).toBe(0)
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workerLastVirtualTaskTimestamp.get(workerNodeKey).end
      ).toBe(0)
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.FAIR_SHARE
      ).workerLastVirtualTaskTimestamp
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    for (const workerNodeKey of pool.workerChoiceStrategyContext.workerChoiceStrategies
      .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
      .workerLastVirtualTaskTimestamp.keys()) {
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workerLastVirtualTaskTimestamp.get(workerNodeKey).start
      ).toBe(0)
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workerLastVirtualTaskTimestamp.get(workerNodeKey).end
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
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).currentWorkerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    for (const workerNodeKey of pool.workerChoiceStrategyContext.workerChoiceStrategies
      .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
      .workersTaskRunTime.keys()) {
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workersTaskRunTime.get(workerNodeKey).weight
      ).toBeGreaterThan(0)
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workersTaskRunTime.get(workerNodeKey).runTime
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
    expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    )
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy default tasks usage statistics requirements', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().runTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().avgRunTime
    ).toBe(true)
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics().medRunTime
    ).toBe(false)
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
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workersTaskRunTime.size
    ).toBe(pool.workerNodes.length)
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
    const maxMultiplier =
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight * 50
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    if (process.platform !== 'win32') {
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
          pool.workerChoiceStrategyContext.workerChoiceStrategy
        ).workersTaskRunTime.size
      ).toBe(pool.workerNodes.length)
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy internals are resets after setting it', async () => {
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      ).currentWorkerNodeId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      ).defaultWorkerWeight
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      ).workersTaskRunTime
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).currentWorkerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    for (const workerNodeKey of pool.workerChoiceStrategyContext.workerChoiceStrategies
      .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
      .workersTaskRunTime.keys()) {
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workersTaskRunTime.get(workerNodeKey).runTime
      ).toBe(0)
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      ).currentWorkerNodeId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      ).defaultWorkerWeight
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      ).workersTaskRunTime
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).currentWorkerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    for (const workerNodeKey of pool.workerChoiceStrategyContext.workerChoiceStrategies
      .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
      .workersTaskRunTime.keys()) {
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies
          .get(pool.workerChoiceStrategyContext.workerChoiceStrategy)
          .workersTaskRunTime.get(workerNodeKey).runTime
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
      new Error("Invalid worker choice strategy 'UNKNOWN_STRATEGY'")
    )
  })
})
