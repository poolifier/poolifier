import {
  CircularBuffer,
  describe,
  DynamicThreadPool,
  expect,
  FixedClusterPool,
  it,
  numberOfWorkers,
  ready,
  WorkerChoiceStrategies,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that pool execute() arguments are checked', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    await ready(pool)
    await expect(pool.execute(undefined, 0)).rejects.toThrow(
      new TypeError('name argument must be a string')
    )
    await expect(pool.execute(undefined, '')).rejects.toThrow(
      new TypeError('name argument must not be an empty string')
    )
    await expect(pool.execute(undefined, undefined, {})).rejects.toThrow(
      new TypeError('abortSignal argument must be an AbortSignal')
    )
    await expect(
      pool.execute(undefined, undefined, new AbortController().signal, {})
    ).rejects.toThrow(new TypeError('transferList argument must be an array'))
    await expect(pool.execute(undefined, 'unknown')).rejects.toThrow(
      new Error("Task function 'unknown' not found")
    )
    await pool.destroy()
    await expect(pool.execute()).rejects.toThrow(
      new Error('Cannot execute a task on not started pool')
    )
  })

  it('Verify that pool worker tasks usage are computed', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    await ready(pool)
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        elu: {
          active: {
            history: expect.any(CircularBuffer),
          },
          idle: {
            history: expect.any(CircularBuffer),
          },
        },
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: 0,
          executing: maxMultiplier,
          failed: 0,
          maxQueued: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        elu: {
          active: {
            history: expect.any(CircularBuffer),
          },
          idle: {
            history: expect.any(CircularBuffer),
          },
        },
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: maxMultiplier,
          executing: 0,
          failed: 0,
          maxQueued: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
    }
    await pool.destroy()
  })

  it("Verify that pool worker tasks usage aren't reset at worker choice strategy change", async () => {
    const pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    const promises = new Set()
    const maxMultiplier = 2
    for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        elu: {
          active: {
            history: expect.any(CircularBuffer),
          },
          idle: {
            history: expect.any(CircularBuffer),
          },
        },
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          failed: 0,
          maxQueued: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        numberOfWorkers * maxMultiplier
      )
    }
    pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.usage).toStrictEqual({
        elu: {
          active: {
            history: expect.any(CircularBuffer),
          },
          idle: {
            history: expect.any(CircularBuffer),
          },
        },
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          failed: 0,
          maxQueued: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: {
          history: expect.any(CircularBuffer),
        },
      })
      expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
        numberOfWorkers * maxMultiplier
      )
    }
    await pool.destroy()
  })
})
