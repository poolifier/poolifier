import { expect } from 'expect'
import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  WorkerChoiceStrategies
} from '../../../lib/index.js'
import { CircularArray } from '../../../lib/circular-array.js'
import { sleep } from '../../test-utils.js'

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
      './tests/worker-files/thread/testWorker.mjs'
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
        './tests/worker-files/thread/testWorker.mjs',
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
        './tests/worker-files/thread/testWorker.mjs'
      )
      pool.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(pool.opts.workerChoiceStrategy).toBe(workerChoiceStrategy)
      expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy
      )
      expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
        retries: 6,
        runTime: { median: false },
        waitTime: { median: false },
        elu: { median: false }
      })
      expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
        retries: 6,
        runTime: { median: false },
        waitTime: { median: false },
        elu: { median: false }
      })
      await pool.destroy()
    }
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      const pool = new DynamicClusterPool(
        min,
        max,
        './tests/worker-files/cluster/testWorker.js'
      )
      pool.setWorkerChoiceStrategy(workerChoiceStrategy, { retries: 3 })
      expect(pool.opts.workerChoiceStrategy).toBe(workerChoiceStrategy)
      expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy
      )
      expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
        retries: 3,
        runTime: { median: false },
        waitTime: { median: false },
        elu: { median: false }
      })
      expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
        retries: 3,
        runTime: { median: false },
        waitTime: { median: false },
        elu: { median: false }
      })
      await pool.destroy()
    }
  })

  it('Verify available strategies default internals at pool creation', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy
        ).nextWorkerNodeKey
      ).toBe(0)
      expect(
        pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy
        ).previousWorkerNodeKey
      ).toBe(0)
      if (
        workerChoiceStrategy === WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      ) {
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).defaultWorkerWeight
        ).toBeGreaterThan(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workerNodeVirtualTaskRunTime
        ).toBe(0)
      } else if (
        workerChoiceStrategy ===
        WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
      ) {
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).defaultWorkerWeight
        ).toBeGreaterThan(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workerNodeVirtualTaskRunTime
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).roundId
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workerNodeId
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).roundWeights
        ).toStrictEqual([
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).defaultWorkerWeight
        ])
      }
    }
    await pool.destroy()
  })

  it('Verify strategies wait for worker node readiness in dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await sleep(600)
    expect(pool.starting).toBe(false)
    expect(pool.workerNodes.length).toBe(min)
    const maxMultiplier = 10000
    const promises = new Set()
    for (let i = 0; i < max * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    expect(pool.workerNodes.length).toBe(max)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
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
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: new CircularArray()
        },
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
          }
        }
      })
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBe(pool.workerNodes.length - 1)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy can be run in a dynamic pool', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
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
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: new CircularArray()
        },
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBe(pool.workerNodes.length - 1)
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
      results.add(pool.workerNodes[pool.chooseWorkerNode()].info.id)
    }
    expect(results.size).toBe(max)
    await pool.destroy()
    pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
    )
    results = new Set()
    for (let i = 0; i < max; i++) {
      results.add(pool.workerNodes[pool.chooseWorkerNode()].info.id)
    }
    expect(results.size).toBe(max)
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy internals are resets after setting it', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
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
      ).previousWorkerNodeKey
    ).toBe(0)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
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
      ).previousWorkerNodeKey
    ).toBe(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_USED strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: new CircularArray()
        },
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_USED strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: new CircularArray()
        },
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_BUSY strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_BUSY strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_ELU strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: new CircularArray()
        },
        waitTime: {
          history: new CircularArray()
        },
        elu: expect.objectContaining({
          idle: expect.objectContaining({
            history: expect.any(CircularArray)
          }),
          active: expect.objectContaining({
            history: expect.any(CircularArray)
          })
        })
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.elu.active.aggregate == null) {
        expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.elu.idle.aggregate == null) {
        expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(0)
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
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify LEAST_ELU strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: {
          history: new CircularArray()
        },
        waitTime: {
          history: new CircularArray()
        },
        elu: expect.objectContaining({
          idle: expect.objectContaining({
            history: expect.any(CircularArray)
          }),
          active: expect.objectContaining({
            history: expect.any(CircularArray)
          })
        })
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        max * maxMultiplier
      )
      if (workerNode.usage.elu.active.aggregate == null) {
        expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.elu.idle.aggregate == null) {
        expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(0)
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
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: new CircularArray()
        },
        elu: expect.objectContaining({
          idle: expect.objectContaining({
            history: expect.any(CircularArray)
          }),
          active: expect.objectContaining({
            history: expect.any(CircularArray)
          })
        })
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
      if (workerNode.usage.elu.active.aggregate == null) {
        expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.elu.idle.aggregate == null) {
        expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(0)
      }
      if (workerNode.usage.elu.utilization == null) {
        expect(workerNode.usage.elu.utilization).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
      }
      expect(workerNode.strategyData.virtualTaskEndTimestamp).toBeGreaterThan(0)
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: new CircularArray()
        },
        elu: expect.objectContaining({
          idle: expect.objectContaining({
            history: expect.any(CircularArray)
          }),
          active: expect.objectContaining({
            history: expect.any(CircularArray)
          })
        })
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
      if (workerNode.usage.elu.active.aggregate == null) {
        expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.elu.idle.aggregate == null) {
        expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(0)
      }
      if (workerNode.usage.elu.utilization == null) {
        expect(workerNode.usage.elu.utilization).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
      }
      expect(workerNode.strategyData.virtualTaskEndTimestamp).toBeGreaterThan(0)
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy can be run in a dynamic pool with median runtime statistic', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      expect(workerNode.usage).toStrictEqual({
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          queued: 0,
          maxQueued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: new CircularArray()
        },
        elu: expect.objectContaining({
          idle: expect.objectContaining({
            history: expect.any(CircularArray)
          }),
          active: expect.objectContaining({
            history: expect.any(CircularArray)
          })
        })
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
      if (workerNode.usage.elu.active.aggregate == null) {
        expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.elu.idle.aggregate == null) {
        expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(0)
      }
      if (workerNode.usage.elu.utilization == null) {
        expect(workerNode.usage.elu.utilization).toBeUndefined()
      } else {
        expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
      }
      expect(workerNode.strategyData.virtualTaskEndTimestamp).toBeGreaterThan(0)
    }
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify FAIR_SHARE strategy internals are resets after setting it', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
    for (const workerNode of pool.workerNodes) {
      workerNode.strategyData = {
        virtualTaskEndTimestamp: performance.now()
      }
    }
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.strategyData.virtualTaskEndTimestamp).toBeUndefined()
    }
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
    for (const workerNode of pool.workerNodes) {
      workerNode.strategyData = {
        virtualTaskEndTimestamp: performance.now()
      }
    }
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.strategyData.virtualTaskEndTimestamp).toBeUndefined()
    }
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerNodeVirtualTaskRunTime
    ).toBeGreaterThanOrEqual(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerNodeVirtualTaskRunTime
    ).toBeGreaterThanOrEqual(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool with median runtime statistic', async () => {
    const pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerNodeVirtualTaskRunTime
    ).toBeGreaterThanOrEqual(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify WEIGHTED_ROUND_ROBIN strategy internals are resets after setting it', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workerNodeVirtualTaskRunTime
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
      ).previousWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerNodeVirtualTaskRunTime
    ).toBe(0)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workerNodeVirtualTaskRunTime
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
      ).previousWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerNodeVirtualTaskRunTime
    ).toBe(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy default policy', async () => {
    const workerChoiceStrategy =
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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
      './tests/worker-files/thread/testWorker.mjs',
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

  it('Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy can be run in a fixed pool', async () => {
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
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
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
      ).workerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
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
      './tests/worker-files/thread/testWorker.mjs',
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
          sequentiallyStolen: 0,
          stolen: 0,
          failed: 0
        },
        runTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
        waitTime: {
          history: new CircularArray()
        },
        elu: {
          idle: {
            history: new CircularArray()
          },
          active: {
            history: new CircularArray()
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
      ).workerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
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
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).roundId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workerNodeId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).previousWorkerNodeKey
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
      ).roundId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
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
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).roundId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).workerNodeId
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeDefined()
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      ).previousWorkerNodeKey
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
      ).roundId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).workerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategyContext.workerChoiceStrategy
      ).defaultWorkerWeight
    ).toBeGreaterThan(0)
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

  it('Verify unknown strategy throw error', () => {
    expect(
      () =>
        new DynamicThreadPool(
          min,
          max,
          './tests/worker-files/thread/testWorker.mjs',
          { workerChoiceStrategy: 'UNKNOWN_STRATEGY' }
        )
    ).toThrow("Invalid worker choice strategy 'UNKNOWN_STRATEGY'")
  })
})
