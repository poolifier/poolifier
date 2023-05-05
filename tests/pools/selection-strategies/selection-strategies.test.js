const { expect } = require('expect')
const {
  WorkerChoiceStrategies,
  DynamicThreadPool,
  FixedThreadPool,
  FixedClusterPool
} = require('../../../lib')

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

  it('Verify available strategies are taken at pool creation', async () => {
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      const pool = new FixedThreadPool(
        max,
        './tests/worker-files/thread/testWorker.js',
        { workerChoiceStrategy }
      )
      expect(pool.opts.workerChoiceStrategy).toBe(workerChoiceStrategy)
      expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy
      )
      await pool.destroy()
    }
  })

  it('Verify available strategies can be set after pool creation', async () => {
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      const pool = new DynamicThreadPool(
        min,
        max,
        './tests/worker-files/thread/testWorker.js'
      )
      pool.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(pool.opts.workerChoiceStrategy).toBe(workerChoiceStrategy)
      expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy
      )
      await pool.destroy()
    }
  })

  it('Verify available strategies default internals at pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      if (workerChoiceStrategy === WorkerChoiceStrategies.ROUND_ROBIN) {
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).nextWorkerNodeId
        ).toBe(0)
      } else if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workersVirtualTaskTimestamp
        ).toBeInstanceOf(Array)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workersVirtualTaskTimestamp.length
        ).toBe(0)
      } else if (
        workerChoiceStrategy === WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      ) {
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).currentWorkerNodeId
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).defaultWorkerWeight
        ).toBeGreaterThan(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workerVirtualTaskRunTime
        ).toBe(0)
      }
    }
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy default tasks usage statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
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
      { workerChoiceStrategy }
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
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
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
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy runtime behavior', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedClusterPool(
      max,
      './tests/worker-files/cluster/testWorker.js',
      { workerChoiceStrategy }
    )
    let results = new Set()
    for (let i = 0; i < max; i++) {
      results.add(pool.chooseWorkerNode()[1].worker.id)
    }
    expect(results.size).toBe(max)
    await pool.destroy()
    pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    results = new Set()
    for (let i = 0; i < max; i++) {
      results.add(pool.chooseWorkerNode()[1].worker.threadId)
    }
    expect(results.size).toBe(max)
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy internals are resets after setting it', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).nextWorkerNodeId
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
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
        workerChoiceStrategy
      ).nextWorkerNodeId
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeId
    ).toBe(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_USED strategy default tasks usage statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LESS_USED
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
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
      { workerChoiceStrategy }
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
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
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
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LESS_BUSY strategy default tasks usage statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LESS_BUSY
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
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
      { workerChoiceStrategy }
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
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
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
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy default tasks usage statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
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
      { workerChoiceStrategy }
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
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workersVirtualTaskTimestamp.length
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
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workersVirtualTaskTimestamp.length
    ).toBe(pool.workerNodes.length)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy can be run in a dynamic pool with median run time statistic', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      {
        workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE,
        workerChoiceStrategyOptions: {
          medRunTime: true
        }
      }
    )
    // TODO: Create a better test to cover `FairShareChoiceStrategy#choose`
    const promises = []
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage.avgRunTime).toBeDefined()
      expect(workerNode.tasksUsage.avgRunTime).toBe(0)
      expect(workerNode.tasksUsage.medRunTime).toBeDefined()
      expect(workerNode.tasksUsage.medRunTime).toBeGreaterThan(0)
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workersVirtualTaskTimestamp.length
    ).toBe(pool.workerNodes.length)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy internals are resets after setting it', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp
    ).toBeInstanceOf(Array)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp.length
    ).toBe(0)
    pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).workersVirtualTaskTimestamp[0] = 0
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp.length
    ).toBe(1)
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp
    ).toBeInstanceOf(Array)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp.length
    ).toBe(0)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp
    ).toBeInstanceOf(Array)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp.length
    ).toBe(0)
    pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).workersVirtualTaskTimestamp[0] = 0
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp.length
    ).toBe(1)
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp
    ).toBeInstanceOf(Array)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskTimestamp.length
    ).toBe(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy default tasks usage statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
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
      { workerChoiceStrategy }
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
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerVirtualTaskRunTime
    ).toBeGreaterThanOrEqual(0)
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
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerVirtualTaskRunTime
    ).toBeGreaterThanOrEqual(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool with median run time statistic', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      {
        workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
        workerChoiceStrategyOptions: {
          medRunTime: true
        }
      }
    )
    // TODO: Create a better test to cover `WeightedRoundRobinWorkerChoiceStrategy#choose`
    const promises = []
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.push(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage.avgRunTime).toBeDefined()
      expect(workerNode.tasksUsage.avgRunTime).toBe(0)
      expect(workerNode.tasksUsage.medRunTime).toBeDefined()
      expect(workerNode.tasksUsage.medRunTime).toBeGreaterThan(0)
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerVirtualTaskRunTime
    ).toBeGreaterThanOrEqual(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy internals are resets after setting it', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).currentWorkerNodeId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workerVirtualTaskRunTime
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
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
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workerVirtualTaskRunTime
    ).toBe(0)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).currentWorkerNodeId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workerVirtualTaskRunTime
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
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
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workerVirtualTaskRunTime
    ).toBe(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify unknown strategy throw error', () => {
    expect(
      () =>
        new DynamicThreadPool(
          min,
          max,
          './tests/worker-files/thread/testWorker.js',
          { workerChoiceStrategy: 'UNKNOWN_STRATEGY' }
        )
    ).toThrowError("Invalid worker choice strategy 'UNKNOWN_STRATEGY'")
  })
})
