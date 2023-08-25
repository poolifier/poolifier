const { expect } = require('expect')
const {
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  WorkerChoiceStrategies
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
          ).nextWorkerNodeKey
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
          ).nextWorkerNodeKey
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
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.ROUND_ROBIN
      ).nextWorkerNodeKey
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        WorkerChoiceStrategies.ROUND_ROBIN
      ).nextWorkerNodeKey
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
      ).nextWorkerNodeKey
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
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
      ).nextWorkerNodeKey
    ).toBeDefined()
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
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
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
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
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
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
      expect(workerNode.usage).toMatchObject({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.runTime.aggregate == null) {
        expect(workerNode.usage.runTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
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
      expect(workerNode.usage).toMatchObject({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.runTime.aggregate == null) {
        expect(workerNode.usage.runTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
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
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
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
      expect(workerNode.usage).toMatchObject({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.elu.utilization == null) {
        expect(workerNode.usage.elu.utilization).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
      }
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
      expect(workerNode.usage).toMatchObject({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.elu.utilization == null) {
        expect(workerNode.usage.elu.utilization).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
      }
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
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
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
      expect(workerNode.usage).toMatchObject({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.runTime.aggregate == null) {
        expect(workerNode.usage.runTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.runTime.average == null) {
        expect(workerNode.usage.runTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
      }
      if (workerNode.usage.elu.utilization == null) {
        expect(workerNode.usage.elu.utilization).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
      }
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
      expect(workerNode.usage).toMatchObject({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.runTime.aggregate == null) {
        expect(workerNode.usage.runTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.runTime.average == null) {
        expect(workerNode.usage.runTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
      }
      if (workerNode.usage.elu.utilization == null) {
        expect(workerNode.usage.elu.utilization).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
      }
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
      expect(workerNode.usage).toMatchObject({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.runTime.aggregate == null) {
        expect(workerNode.usage.runTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.runTime.median == null) {
        expect(workerNode.usage.runTime.median).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.median).toBeGreaterThan(0)
      }
      if (workerNode.usage.elu.utilization == null) {
        expect(workerNode.usage.elu.utilization).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
      }
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
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.runTime.aggregate == null) {
        expect(workerNode.usage.runTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.runTime.average == null) {
        expect(workerNode.usage.runTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
      }
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.runTime.aggregate == null) {
        expect(workerNode.usage.runTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.runTime.average == null) {
        expect(workerNode.usage.runTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
      }
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.runTime.aggregate == null) {
        expect(workerNode.usage.runTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.runTime.median == null) {
        expect(workerNode.usage.runTime.median).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.median).toBeGreaterThan(0)
      }
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
      ).nextWorkerNodeKey
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
      ).nextWorkerNodeKey
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
      ).nextWorkerNodeKey
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
      ).nextWorkerNodeKey
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
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
    })
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategyContext.getStrategyPolicy()).toStrictEqual({
      dynamicWorkerUsage: false,
      dynamicWorkerReady: true
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
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
      ).roundId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: expect.any(CircularArray)
        },
        waitTime: {
          history: expect.any(CircularArray)
        },
        elu: {
          idle: {
            history: expect.any(CircularArray)
          },
          active: {
            history: expect.any(CircularArray)
          }
        }
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).roundId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
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
      ).roundId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).nextWorkerNodeKey
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
      ).roundId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
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
      ).roundId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).nextWorkerNodeKey
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
      ).nextWorkerNodeKey
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
