const expect = require('expect')
const {
  WorkerChoiceStrategies,
  DynamicThreadPool,
  FixedThreadPool
} = require('../../lib/index')

describe('Selection strategies test suite', () => {
  it('Verify that WorkerChoiceStrategies enumeration provides string values', () => {
    expect(WorkerChoiceStrategies.ROUND_ROBIN).toBe('ROUND_ROBIN')
    expect(WorkerChoiceStrategies.LESS_RECENTLY_USED).toBe('LESS_RECENTLY_USED')
  })

  it('Verify LESS_RECENTLY_USED strategy is taken', async () => {
    const max = 3
    const pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js',
      { workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED }
    )

    expect(pool.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )

    // TODO: Create a better test to cover `LessRecentlyUsedWorkerChoiceStrategy#choose`
    const promises = []
    for (let i = 0; i < max * 2; i++) {
      promises.push(pool.execute({ test: 'test' }))
    }
    await Promise.all(promises)

    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify unknown strategies throw error', () => {
    const min = 1
    const max = 3
    expect(
      () =>
        new DynamicThreadPool(
          min,
          max,
          './tests/worker-files/thread/testWorker.js',
          {
            maxTasks: 1000,
            workerChoiceStrategy: 'UNKNOWN_STRATEGY'
          }
        )
    ).toThrowError(
      new Error("Worker choice strategy 'UNKNOWN_STRATEGY' not found")
    )
  })
})
