import { randomInt } from 'node:crypto'

import { expect } from 'expect'

import { CircularArray } from '../../../lib/circular-array.cjs'
import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  WorkerChoiceStrategies
} from '../../../lib/index.cjs'

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
    expect(pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
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
      expect(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).toBe(workerChoiceStrategy)
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
      expect(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).toBe(workerChoiceStrategy)
      await pool.destroy()
    }
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      const pool = new DynamicClusterPool(
        min,
        max,
        './tests/worker-files/cluster/testWorker.cjs'
      )
      pool.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(pool.opts.workerChoiceStrategy).toBe(workerChoiceStrategy)
      expect(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).toBe(workerChoiceStrategy)
      await pool.destroy()
    }
  })

  it('Verify available strategies default internals at pool creation', async () => {
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      const pool = new FixedThreadPool(
        max,
        './tests/worker-files/thread/testWorker.mjs',
        { workerChoiceStrategy }
      )
      expect(
        pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategy
        ).nextWorkerNodeKey
      ).toBe(0)
      expect(
        pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategy
        ).previousWorkerNodeKey
      ).toBe(0)
      if (
        workerChoiceStrategy === WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      ) {
        expect(
          pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workerNodeVirtualTaskExecutionTime
        ).toBe(0)
      } else if (
        workerChoiceStrategy ===
        WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
      ) {
        expect(
          pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workerNodeVirtualTaskExecutionTime
        ).toBe(0)
        expect(
          pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).roundId
        ).toBe(0)
        expect(
          pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).workerNodeId
        ).toBe(0)
        expect(
          pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
            workerChoiceStrategy
          ).roundWeights.length
        ).toBe(1)
        expect(
          Number.isSafeInteger(
            pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
              workerChoiceStrategy
            ).roundWeights[0]
          )
        ).toBe(true)
      }
      await pool.destroy()
    }
  })

  it('Verify ROUND_ROBIN strategy default policy', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
    )
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBe(pool.workerNodes.length - 1)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify ROUND_ROBIN strategy runtime behavior', async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedClusterPool(
      max,
      './tests/worker-files/cluster/testWorker.cjs',
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

  it("Verify ROUND_ROBIN strategy internals aren't reset after setting it", async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
    )
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
    ).nextWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
    ).previousWorkerNodeKey = randomInt(1, max - 1)
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBeGreaterThan(0)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
    )
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
    ).nextWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
    ).previousWorkerNodeKey = randomInt(1, max - 1)
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBeGreaterThan(0)
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: true,
        average: true,
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: true,
        average: true,
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
        waitTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
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
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.average == null) {
        expect(workerNode.usage.waitTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.average).toBeGreaterThan(0)
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
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
        waitTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
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
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.average == null) {
        expect(workerNode.usage.waitTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.average).toBeGreaterThan(0)
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
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
        waitTime: expect.objectContaining({
          history: expect.any(CircularArray)
        }),
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
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.median == null) {
        expect(workerNode.usage.waitTime.median).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.median).toBeGreaterThan(0)
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
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(expect.any(Number))
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(expect.any(Number))
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it("Verify FAIR_SHARE strategy internals aren't reset after setting it", async () => {
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
      expect(workerNode.strategyData.virtualTaskEndTimestamp).toBeGreaterThan(0)
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
      expect(workerNode.strategyData.virtualTaskEndTimestamp).toBeGreaterThan(0)
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: true,
        average: true,
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: true,
        average: true,
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
      if (workerNode.usage.runTime.average == null) {
        expect(workerNode.usage.runTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.average == null) {
        expect(workerNode.usage.waitTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.average).toBeGreaterThan(0)
      }
    }
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).workerNodeVirtualTaskExecutionTime
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
      if (workerNode.usage.runTime.average == null) {
        expect(workerNode.usage.runTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.average == null) {
        expect(workerNode.usage.waitTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.average).toBeGreaterThan(0)
      }
    }
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).workerNodeVirtualTaskExecutionTime
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
      if (workerNode.usage.runTime.median == null) {
        expect(workerNode.usage.runTime.median).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.median).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.median == null) {
        expect(workerNode.usage.waitTime.median).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.median).toBeGreaterThan(0)
      }
    }
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toEqual(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).workerNodeVirtualTaskExecutionTime
    ).toBeGreaterThanOrEqual(0)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it("Verify WEIGHTED_ROUND_ROBIN strategy internals aren't reset after setting it", async () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
    )
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).nextWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).previousWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).workerNodeVirtualTaskRunTime = randomInt(100, 1000)
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).workerNodeVirtualTaskRunTime
    ).toBeGreaterThan(99)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
    )
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).nextWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).previousWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).workerNodeVirtualTaskRunTime = randomInt(100, 1000)
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).workerNodeVirtualTaskRunTime
    ).toBeGreaterThan(99)
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
    expect(pool.workerChoiceStrategiesContext.getPolicy()).toStrictEqual({
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: true,
        average: true,
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
      pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
    ).toStrictEqual({
      runTime: {
        aggregate: true,
        average: true,
        median: false
      },
      waitTime: {
        aggregate: true,
        average: true,
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
      if (workerNode.usage.runTime.average == null) {
        expect(workerNode.usage.runTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.average == null) {
        expect(workerNode.usage.waitTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.average).toBeGreaterThan(0)
      }
    }
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).roundId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).workerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).roundWeights.length
    ).toBe(1)
    expect(
      Number.isSafeInteger(
        pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
          pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
        ).roundWeights[0]
      )
    ).toBe(true)
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
      if (workerNode.usage.runTime.average == null) {
        expect(workerNode.usage.runTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.aggregate == null) {
        expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
      }
      if (workerNode.usage.waitTime.average == null) {
        expect(workerNode.usage.waitTime.average).toBeUndefined()
      } else {
        expect(workerNode.usage.waitTime.average).toBeGreaterThan(0)
      }
    }
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).roundId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).workerNodeId
    ).toBe(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBe(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toEqual(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).roundWeights.length
    ).toBe(1)
    expect(
      Number.isSafeInteger(
        pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
          pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
        ).roundWeights[0]
      )
    ).toBe(true)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it("Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy internals aren't reset after setting it", async () => {
    const workerChoiceStrategy =
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    let pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
    )
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).roundId = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).workerNodeId = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).nextWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).previousWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).roundWeights = [randomInt(1, max - 1), randomInt(1, max - 1)]
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).roundId
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).workerNodeId
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).roundWeights.length
    ).toBeGreaterThan(1)
    expect(
      Number.isSafeInteger(
        pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
          pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
        ).roundWeights[0]
      )
    ).toBe(true)
    await pool.destroy()
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
      { workerChoiceStrategy }
    )
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).roundId = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).workerNodeId = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).nextWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).previousWorkerNodeKey = randomInt(1, max - 1)
    pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategy
    ).roundWeights = [randomInt(1, max - 1), randomInt(1, max - 1)]
    pool.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).roundId
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).workerNodeId
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).previousWorkerNodeKey
    ).toBeGreaterThan(0)
    expect(
      pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).roundWeights.length
    ).toBeGreaterThan(1)
    expect(
      Number.isSafeInteger(
        pool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
          pool.workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
        ).roundWeights[0]
      )
    ).toBe(true)
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
