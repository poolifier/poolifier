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
    expect(WorkerChoiceStrategies.LEAST_ELU).toBe('LEAST_ELU')
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

  it('Verify ROUND_ROBIN strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: true
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy default tasks statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: false,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: false,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
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

  it('Verify LEAST_USED strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: false
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_USED strategy default tasks statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: false,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: false,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
      })
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_BUSY strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: false
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_BUSY strategy default tasks statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: true,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: true,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: expect.any(Number),
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: expect.any(Number),
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
      })
      expect(workerNode.workerUsage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.workerUsage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      expect(workerNode.workerUsage.runTime.aggregate).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.waitTime.aggregate).toBeGreaterThanOrEqual(
        0
      )
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: expect.any(Number),
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: expect.any(Number),
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
      })
      expect(workerNode.workerUsage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.workerUsage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      expect(workerNode.workerUsage.runTime.aggregate).toBeGreaterThan(0)
      expect(workerNode.workerUsage.waitTime.aggregate).toBeGreaterThan(0)
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_ELU strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: false
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_ELU strategy default tasks statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: false,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: true,
        average: false,
        median: false
      }
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: false,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: true,
        average: false,
        median: false
      }
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_ELU strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_ELU }
    )
    // TODO: Create a better test to cover `LeastEluWorkerChoiceStrategy#choose`
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: expect.any(Number),
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: expect.any(Number)
        }
      })
      expect(workerNode.workerUsage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      expect(workerNode.workerUsage.elu.utilization).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.elu.utilization).toBeLessThanOrEqual(1)
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_ELU strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_ELU }
    )
    // TODO: Create a better test to cover `LeastEluWorkerChoiceStrategy#choose`
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: expect.any(Number),
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: expect.any(Number)
        }
      })
      expect(workerNode.workerUsage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      expect(workerNode.workerUsage.elu.utilization).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.elu.utilization).toBeLessThanOrEqual(1)
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: false
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: false
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy default tasks statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: true,
        average: true,
        median: false
      }
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: true,
        average: true,
        median: false
      }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: expect.any(Number),
          average: expect.any(Number),
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: expect.any(Number),
            average: expect.any(Number),
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: expect.any(Number)
        }
      })
      expect(workerNode.workerUsage.runTime.aggregate).toBeGreaterThan(0)
      expect(workerNode.workerUsage.runTime.average).toBeGreaterThan(0)
      expect(workerNode.workerUsage.elu.utilization).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.elu.utilization).toBeLessThanOrEqual(1)
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: expect.any(Number),
          average: expect.any(Number),
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: expect.any(Number),
            average: expect.any(Number),
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: expect.any(Number)
        }
      })
      expect(workerNode.workerUsage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.workerUsage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      expect(workerNode.workerUsage.runTime.aggregate).toBeGreaterThan(0)
      expect(workerNode.workerUsage.runTime.average).toBeGreaterThan(0)
      expect(workerNode.workerUsage.elu.utilization).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.elu.utilization).toBeLessThanOrEqual(1)
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
          runTime: { median: true }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: expect.any(Number),
          average: 0,
          median: expect.any(Number),
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: expect.any(Number),
            average: expect.any(Number),
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: expect.any(Number)
        }
      })
      expect(workerNode.workerUsage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.workerUsage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      expect(workerNode.workerUsage.runTime.aggregate).toBeGreaterThan(0)
      expect(workerNode.workerUsage.runTime.median).toBeGreaterThan(0)
      expect(workerNode.workerUsage.elu.utilization).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.elu.utilization).toBeLessThanOrEqual(1)
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

  it('Verify WEIGHTED_ROUND_ROBIN strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: true
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy default tasks statistics requirements', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: expect.any(Number),
          average: expect.any(Number),
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
      })
      expect(workerNode.workerUsage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      expect(workerNode.workerUsage.runTime.aggregate).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.runTime.average).toBeGreaterThanOrEqual(0)
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: expect.any(Number),
          average: expect.any(Number),
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
      })
      expect(workerNode.workerUsage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      expect(workerNode.workerUsage.runTime.aggregate).toBeGreaterThan(0)
      expect(workerNode.workerUsage.runTime.average).toBeGreaterThan(0)
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
          runTime: { median: true }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: expect.any(Number),
          average: 0,
          median: expect.any(Number),
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
      })
      expect(workerNode.workerUsage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.workerUsage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      expect(workerNode.workerUsage.runTime.aggregate).toBeGreaterThan(0)
      expect(workerNode.workerUsage.runTime.median).toBeGreaterThan(0)
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

  it('Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy default policy', async () => {
    const workerChoiceStrategy =
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      useDynamicWorker: true
    })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy default tasks statistics requirements', async () => {
    const workerChoiceStrategy =
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: false,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(
      pool.workerChoiceStrategyContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: false,
        average: false,
        median: false
      },
      waitTime: {
        aggregate: false,
        average: false,
        median: false
      },
      elu: {
        aggregate: false,
        average: false,
        median: false
      }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
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
      expect(workerNode.workerUsage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          failed: 0
        },
        runTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        waitTime: {
          aggregate: 0,
          average: 0,
          median: 0,
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          active: {
            aggregate: 0,
            average: 0,
            median: 0,
            history: expect.any(CircularArray)
          },
          utilization: 0
        }
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
