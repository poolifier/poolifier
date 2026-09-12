import {
  describe,
  DynamicClusterPool,
  DynamicThreadPool,
  expect,
  FixedClusterPool,
  FixedThreadPool,
  it,
  numberOfWorkers,
  StubPoolWithIsMain,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that pool can be created and destroyed', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool).toBeInstanceOf(FixedThreadPool)
    await pool.destroy()
  })

  it('Verify that pool cannot be created from a non main thread/process', () => {
    expect(
      () =>
        new StubPoolWithIsMain(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          {
            errorHandler: e => console.error(e),
          }
        )
    ).toThrow(
      new Error(
        'Cannot start a pool from a worker with the same type as the pool'
      )
    )
  })

  it('Verify that pool statuses properties are set', async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool.started).toBe(true)
    expect(pool.starting).toBe(false)
    expect(pool.destroying).toBe(false)
    await pool.destroy()
    expect(pool.started).toBe(false)
    expect(pool.starting).toBe(false)
    expect(pool.destroying).toBe(false)
  })

  it('Verify that filePath is checked', () => {
    expect(() => new FixedThreadPool(numberOfWorkers)).toThrow(
      new TypeError('The worker file path must be defined')
    )
    expect(() => new FixedThreadPool(numberOfWorkers, 0)).toThrow(
      new TypeError('The worker file path must be a string')
    )
    expect(
      () => new FixedThreadPool(numberOfWorkers, './dummyWorker.ts')
    ).toThrow(new Error("Cannot find the worker file './dummyWorker.ts'"))
  })

  it('Verify that numberOfWorkers is checked', () => {
    expect(
      () =>
        new FixedThreadPool(
          undefined,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new Error(
        'Cannot instantiate a pool without specifying the number of workers'
      )
    )
  })

  it('Verify that a negative number of workers is checked', () => {
    expect(
      () =>
        new FixedClusterPool(-1, './tests/worker-files/cluster/testWorker.cjs')
    ).toThrow(
      new RangeError(
        'Cannot instantiate a pool with a negative number of workers'
      )
    )
  })

  it('Verify that a non integer number of workers is checked', () => {
    expect(
      () =>
        new FixedThreadPool(0.25, './tests/worker-files/thread/testWorker.mjs')
    ).toThrow(
      new TypeError(
        'Cannot instantiate a pool with a non safe integer number of workers'
      )
    )
  })

  it('Verify that pool arguments number and pool type are checked', () => {
    expect(
      () =>
        new FixedThreadPool(
          numberOfWorkers,
          './tests/worker-files/thread/testWorker.mjs',
          undefined,
          numberOfWorkers * 2
        )
    ).toThrow(
      new Error(
        'Cannot instantiate a fixed pool with a maximum number of workers defined at initialization'
      )
    )
  })

  it('Verify that dynamic pool sizing is checked', () => {
    expect(
      () =>
        new DynamicClusterPool(
          1,
          undefined,
          './tests/worker-files/cluster/testWorker.cjs'
        )
    ).toThrow(
      new TypeError(
        'Cannot instantiate a dynamic pool without specifying the maximum pool size'
      )
    )
    expect(
      () =>
        new DynamicThreadPool(
          0.5,
          1,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new TypeError(
        'Cannot instantiate a pool with a non safe integer number of workers'
      )
    )
    expect(
      () =>
        new DynamicClusterPool(
          0,
          0.5,
          './tests/worker-files/cluster/testWorker.cjs'
        )
    ).toThrow(
      new TypeError(
        'Cannot instantiate a dynamic pool with a non safe integer maximum pool size'
      )
    )
    expect(
      () =>
        new DynamicThreadPool(
          2,
          1,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new RangeError(
        'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size'
      )
    )
    expect(
      () =>
        new DynamicThreadPool(
          0,
          0,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new RangeError(
        'Cannot instantiate a dynamic pool with a maximum pool size equal to zero'
      )
    )
    expect(
      () =>
        new DynamicClusterPool(
          1,
          1,
          './tests/worker-files/cluster/testWorker.cjs'
        )
    ).toThrow(
      new RangeError(
        'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead'
      )
    )
  })
})
