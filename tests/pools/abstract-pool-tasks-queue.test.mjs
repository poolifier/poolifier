import {
  describe,
  expect,
  FixedThreadPool,
  it,
  numberOfWorkers,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that pool tasks queue can be enabled/disabled', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.opts.enableTasksQueue).toBe(false)
    expect(pool.opts.tasksQueueOptions).toBeUndefined()
    pool.enableTasksQueue(true)
    expect(pool.opts.enableTasksQueue).toBe(true)
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      agingFactor: 0.001,
      concurrency: 1,
      loadExponent: 0.6666666666666666,
      size: numberOfWorkers ** 2,
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
    })
    pool.enableTasksQueue(true, { concurrency: 2 })
    expect(pool.opts.enableTasksQueue).toBe(true)
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      agingFactor: 0.001,
      concurrency: 2,
      loadExponent: 0.6666666666666666,
      size: numberOfWorkers ** 2,
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
    })
    pool.enableTasksQueue(false)
    expect(pool.opts.enableTasksQueue).toBe(false)
    expect(pool.opts.tasksQueueOptions).toBeUndefined()
    await pool.destroy()
  })

  it('Verify that pool tasks queue options can be set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs',
      { enableTasksQueue: true }
    )
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      agingFactor: 0.001,
      concurrency: 1,
      loadExponent: 0.6666666666666666,
      size: numberOfWorkers ** 2,
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
    })
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueueBackPressureSize).toBe(
        pool.opts.tasksQueueOptions.size
      )
    }
    pool.setTasksQueueOptions({
      concurrency: 2,
      size: 2,
      tasksFinishedTimeout: 3000,
      tasksStealingOnBackPressure: false,
      tasksStealingRatio: 0.5,
      taskStealing: false,
    })
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      agingFactor: 0.001,
      concurrency: 2,
      loadExponent: 0.6666666666666666,
      size: 2,
      tasksFinishedTimeout: 3000,
      tasksStealingOnBackPressure: false,
      tasksStealingRatio: 0.5,
      taskStealing: false,
    })
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueueBackPressureSize).toBe(
        pool.opts.tasksQueueOptions.size
      )
    }
    pool.setTasksQueueOptions({
      concurrency: 1,
      tasksStealingOnBackPressure: true,
      taskStealing: true,
    })
    expect(pool.opts.tasksQueueOptions).toStrictEqual({
      agingFactor: 0.001,
      concurrency: 1,
      loadExponent: 0.6666666666666666,
      size: 2,
      tasksFinishedTimeout: 3000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.5,
      taskStealing: true,
    })
    for (const workerNode of pool.workerNodes) {
      expect(workerNode.tasksQueueBackPressureSize).toBe(
        pool.opts.tasksQueueOptions.size
      )
    }
    expect(() => pool.setTasksQueueOptions('invalidTasksQueueOptions')).toThrow(
      new TypeError('Invalid tasks queue options: must be a plain object')
    )
    expect(() => pool.setTasksQueueOptions({ concurrency: 0 })).toThrow(
      new RangeError(
        'Invalid worker node tasks concurrency: 0 is a negative integer or zero'
      )
    )
    expect(() => pool.setTasksQueueOptions({ concurrency: -1 })).toThrow(
      new RangeError(
        'Invalid worker node tasks concurrency: -1 is a negative integer or zero'
      )
    )
    expect(() => pool.setTasksQueueOptions({ concurrency: 0.2 })).toThrow(
      new TypeError('Invalid worker node tasks concurrency: must be an integer')
    )
    expect(() => pool.setTasksQueueOptions({ size: 0 })).toThrow(
      new RangeError(
        'Invalid worker node tasks queue size: 0 is a negative integer or zero'
      )
    )
    expect(() => pool.setTasksQueueOptions({ size: -1 })).toThrow(
      new RangeError(
        'Invalid worker node tasks queue size: -1 is a negative integer or zero'
      )
    )
    expect(() => pool.setTasksQueueOptions({ size: 0.2 })).toThrow(
      new TypeError('Invalid worker node tasks queue size: must be an integer')
    )
    expect(() => pool.setTasksQueueOptions({ tasksStealingRatio: '' })).toThrow(
      new TypeError(
        'Invalid worker node tasks stealing ratio: must be a number'
      )
    )
    expect(() =>
      pool.setTasksQueueOptions({ tasksStealingRatio: 1.1 })
    ).toThrow(
      new RangeError(
        'Invalid worker node tasks stealing ratio: must be between 0 and 1'
      )
    )
    expect(() => pool.setTasksQueueOptions({ agingFactor: '' })).toThrow(
      new TypeError(
        'Invalid worker node tasks queue aging factor: must be a number'
      )
    )
    expect(() => pool.setTasksQueueOptions({ agingFactor: -1 })).toThrow(
      new RangeError(
        'Invalid worker node tasks queue aging factor: must be greater than or equal to 0'
      )
    )
    expect(() => pool.setTasksQueueOptions({ loadExponent: '' })).toThrow(
      new TypeError(
        'Invalid worker node tasks queue load exponent: must be a number'
      )
    )
    expect(() => pool.setTasksQueueOptions({ loadExponent: 0 })).toThrow(
      new RangeError(
        'Invalid worker node tasks queue load exponent: must be greater than 0'
      )
    )
    expect(() => pool.setTasksQueueOptions({ loadExponent: -1 })).toThrow(
      new RangeError(
        'Invalid worker node tasks queue load exponent: must be greater than 0'
      )
    )
    await pool.destroy()
  })
})
