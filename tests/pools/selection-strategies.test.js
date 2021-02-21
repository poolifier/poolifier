const expect = require('expect')
const { WorkerChoiceStrategies, DynamicThreadPool } = require('../../lib/index')
const TestUtils = require('../test-utils')
const min = 1
const max = 2

const poolWithLessRecentlyUsed = new DynamicThreadPool(
  min,
  max,
  './tests/worker-files/thread/testWorker.js',
  {
    maxTasks: 1000,
    workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED
  }
)

describe('Selection strategies test suite', () => {
  it('Verify that WorkerChoiceStrategies enumeration provides string values', () => {
    expect(WorkerChoiceStrategies.ROUND_ROBIN).toBe('ROUND_ROBIN')
    expect(WorkerChoiceStrategies.LESS_RECENTLY_USED).toBe('LESS_RECENTLY_USED')
  })

  it('Verify LESS_RECENTLY_USED is taken', async () => {
    expect(poolWithLessRecentlyUsed.opts.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )

    // TODO: Create a better test to cover `LessRecentlyUsedWorkerChoiceStrategy#choose`
    const promises = []
    let fullPool = 0
    poolWithLessRecentlyUsed.emitter.on('FullPool', () => fullPool++)
    for (let i = 0; i < max * 2; i++) {
      promises.push(poolWithLessRecentlyUsed.execute({ test: 'test' }))
    }
    expect(poolWithLessRecentlyUsed.workers.length).toBe(max)
    expect(fullPool > min).toBeTruthy()
    const res = await TestUtils.waitExits(poolWithLessRecentlyUsed, max - min)
    expect(res).toBe(max - min)
  })

  it('Verify unknown strategies throw error', () => {
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
