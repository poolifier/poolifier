const { expect } = require('expect')
const {
  WorkerChoiceStrategies,
  DynamicThreadPool,
  FixedThreadPool,
  FixedClusterPool
} = require('../../../lib')
const { CircularArray } = require('../../../lib/circular-array')

describe('Selection strategies test suite', () => {
  const min = 0
  const max = 3

  it('Verify that WorkerChoiceStrategies enumeration provides string values', () => {
    expect(WorkerChoiceStrategies.ROUND_ROBIN).toBe('ROUND_ROBIN')
    expect(WorkerChoiceStrategies.LEAST_USED).toBe('LEAST_USED')
    expect(WorkerChoiceStrategies.LEAST_BUSY).toBe('LEAST_BUSY')
    expect(WorkerChoiceStrategies.FAIR_SHARE).toBe('FAIR_SHARE')
    expect(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN).toBe(
      'WEIGHTED_ROUND_ROBIN'
    )
    expect(WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN).toBe(
      'INTERLEAVED_WEIGHTED_ROUND_ROBIN'
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
          ).workersVirtualTaskEndTimestamp
        ).toBeInstanceOf(Array)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workersVirtualTaskEndTimestamp.length
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
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: false,
      avgRunTime: false,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: false,
      avgRunTime: false,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
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
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: maxMultiplier,
        running: 0,
        runTime: 0,
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.ROUND_ROBIN
      ).nextWorkerNodeId
    ).toBe(0)
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
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: maxMultiplier,
        running: 0,
        runTime: 0,
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.ROUND_ROBIN
      ).nextWorkerNodeId
    ).toBe(0)
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
      results.add(pool.workerNodes[pool.chooseWorkerNode()].worker.id)
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
      results.add(pool.workerNodes[pool.chooseWorkerNode()].worker.threadId)
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

  it('Verify LEAST_USED strategy default tasks usage statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: false,
      avgRunTime: false,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: false,
      avgRunTime: false,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_USED strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED }
    )
    // TODO: Create a better test to cover `LeastUsedWorkerChoiceStrategy#choose`
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: maxMultiplier,
        running: 0,
        runTime: 0,
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_USED strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED }
    )
    // TODO: Create a better test to cover `LeastUsedWorkerChoiceStrategy#choose`
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: maxMultiplier,
        running: 0,
        runTime: 0,
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_BUSY strategy default tasks usage statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: true,
      avgRunTime: false,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: true,
      avgRunTime: false,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_BUSY strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_BUSY }
    )
    // TODO: Create a better test to cover `LeastBusyWorkerChoiceStrategy#choose`
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: expect.any(Number),
        running: 0,
        runTime: expect.any(Number),
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
      expect(workerNode.tasksUsage.run).toBeGreaterThan(0)
      expect(workerNode.tasksUsage.run).toBeLessThanOrEqual(max * maxMultiplier)
      expect(workerNode.tasksUsage.runTime).toBeGreaterThan(0)
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_BUSY strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_BUSY }
    )
    // TODO: Create a better test to cover `LeastBusyWorkerChoiceStrategy#choose`
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: expect.any(Number),
        running: 0,
        runTime: expect.any(Number),
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
      expect(workerNode.tasksUsage.run).toBeGreaterThan(0)
      expect(workerNode.tasksUsage.run).toBeLessThanOrEqual(max * maxMultiplier)
      expect(workerNode.tasksUsage.runTime).toBeGreaterThan(0)
    }
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
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: true,
      avgRunTime: true,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: true,
      avgRunTime: true,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
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
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: maxMultiplier,
        running: 0,
        runTime: expect.any(Number),
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: expect.any(Number),
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
      expect(workerNode.tasksUsage.runTime).toBeGreaterThan(0)
      expect(workerNode.tasksUsage.avgRunTime).toBeGreaterThan(0)
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp.length
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
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: maxMultiplier,
        running: 0,
        runTime: expect.any(Number),
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: expect.any(Number),
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
      expect(workerNode.tasksUsage.runTime).toBeGreaterThan(0)
      expect(workerNode.tasksUsage.avgRunTime).toBeGreaterThan(0)
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp.length
    ).toBe(pool.workerNodes.length)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy can be run in a dynamic pool with median runtime statistic', async () => {
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
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: maxMultiplier,
        running: 0,
        runTime: expect.any(Number),
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: expect.any(Number),
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
      expect(workerNode.tasksUsage.runTime).toBeGreaterThan(0)
      expect(workerNode.tasksUsage.medRunTime).toBeGreaterThan(0)
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp.length
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
      ).workersVirtualTaskEndTimestamp
    ).toBeInstanceOf(Array)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp.length
    ).toBe(0)
    pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).workersVirtualTaskEndTimestamp[0] = performance.now()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp.length
    ).toBe(1)
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp
    ).toBeInstanceOf(Array)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp.length
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
      ).workersVirtualTaskEndTimestamp
    ).toBeInstanceOf(Array)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp.length
    ).toBe(0)
    pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).workersVirtualTaskEndTimestamp[0] = performance.now()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp.length
    ).toBe(1)
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp
    ).toBeInstanceOf(Array)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workersVirtualTaskEndTimestamp.length
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
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: true,
      avgRunTime: true,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: true,
      avgRunTime: true,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
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
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: expect.any(Number),
        running: 0,
        runTime: expect.any(Number),
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: expect.any(Number),
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
      expect(workerNode.tasksUsage.run).toBeGreaterThanOrEqual(0)
      expect(workerNode.tasksUsage.run).toBeLessThanOrEqual(max * maxMultiplier)
      expect(workerNode.tasksUsage.runTime).toBeGreaterThanOrEqual(0)
      expect(workerNode.tasksUsage.avgRunTime).toBeGreaterThanOrEqual(0)
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

  it('Verify WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    // TODO: Create a better test to cover `WeightedRoundRobinWorkerChoiceStrategy#choose`
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: expect.any(Number),
        running: 0,
        runTime: expect.any(Number),
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: expect.any(Number),
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
      expect(workerNode.tasksUsage.run).toBeGreaterThan(0)
      expect(workerNode.tasksUsage.run).toBeLessThanOrEqual(max * maxMultiplier)
      expect(workerNode.tasksUsage.runTime).toBeGreaterThan(0)
      expect(workerNode.tasksUsage.avgRunTime).toBeGreaterThan(0)
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

  it('Verify WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool with median runtime statistic', async () => {
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
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: expect.any(Number),
        running: 0,
        runTime: expect.any(Number),
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: expect.any(Number),
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
      expect(workerNode.tasksUsage.run).toBeGreaterThan(0)
      expect(workerNode.tasksUsage.run).toBeLessThanOrEqual(max * maxMultiplier)
      expect(workerNode.tasksUsage.runTime).toBeGreaterThan(0)
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

  it('Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy default tasks usage statistics requirements', async () => {
    const workerChoiceStrategy =
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: false,
      avgRunTime: false,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getRequiredStatistics()
    ).toStrictEqual({
      runTime: false,
      avgRunTime: false,
      medRunTime: false,
      waitTime: false,
      avgWaitTime: false,
      medWaitTime: false
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      {
        workerChoiceStrategy:
          WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
      }
    )
    // TODO: Create a better test to cover `InterleavedWeightedRoundRobinWorkerChoiceStrategy#choose`
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: maxMultiplier,
        running: 0,
        runTime: 0,
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).currentRoundId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).currentWorkerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).roundWeights
    ).toStrictEqual([
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ])
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      {
        workerChoiceStrategy:
          WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
      }
    )
    // TODO: Create a better test to cover `InterleavedWeightedRoundRobinWorkerChoiceStrategy#choose`
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksUsage).toStrictEqual({
        run: maxMultiplier,
        running: 0,
        runTime: 0,
        runTimeHistory: expect.any(CircularArray),
        avgRunTime: 0,
        medRunTime: 0,
        waitTime: 0,
        waitTimeHistory: expect.any(CircularArray),
        avgWaitTime: 0,
        medWaitTime: 0,
        error: 0
      })
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).currentRoundId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).currentWorkerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).roundWeights
    ).toStrictEqual([
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ])
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy internals are resets after setting it', async () => {
    const workerChoiceStrategy =
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).currentRoundId
    ).toBeDefined()
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
      ).roundWeights
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).currentRoundId
    ).toBe(0)
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
      ).roundWeights
    ).toStrictEqual([
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ])
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).currentRoundId
    ).toBeDefined()
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
      ).roundWeights
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
      ).roundWeights
    ).toStrictEqual([
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ])
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
