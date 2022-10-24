const { expect } = require('expect')
// const sinon = require('sinon')
const {
  getWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/selection-strategies-utils')
const {
  FixedThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const {
  RoundRobinWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/round-robin-worker-choice-strategy')
const {
  LessRecentlyUsedWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/less-recently-used-worker-choice-strategy')
const {
  FairShareWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/fair-share-worker-choice-strategy')
const {
  WeightedRoundRobinWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/weighted-round-robin-worker-choice-strategy')

describe('Selection strategies utils test suite', () => {
  const max = 3
  let pool

  before(() => {
    pool = new FixedThreadPool(max, './tests/worker-files/thread/testWorker.js')
  })

  // afterEach(() => {
  //   sinon.restore()
  // })

  after(async () => {
    await pool.destroy()
  })

  it('Verify that getWorkerChoiceStrategy() default return ROUND_ROBIN strategy', () => {
    const strategy = getWorkerChoiceStrategy(pool)
    expect(strategy).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
  })

  it('Verify that getWorkerChoiceStrategy() can return ROUND_ROBIN strategy', () => {
    const strategy = getWorkerChoiceStrategy(
      pool,
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(strategy).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
  })

  it('Verify that getWorkerChoiceStrategy() can return LESS_RECENTLY_USED strategy', () => {
    const strategy = getWorkerChoiceStrategy(
      pool,
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )
    expect(strategy).toBeInstanceOf(LessRecentlyUsedWorkerChoiceStrategy)
  })

  it('Verify that getWorkerChoiceStrategy() can return FAIR_SHARE strategy', () => {
    const strategy = getWorkerChoiceStrategy(
      pool,
      WorkerChoiceStrategies.FAIR_SHARE
    )
    expect(strategy).toBeInstanceOf(FairShareWorkerChoiceStrategy)
  })

  it('Verify that getWorkerChoiceStrategy() can return WEIGHTED_ROUND_ROBIN strategy', () => {
    const strategy = getWorkerChoiceStrategy(
      pool,
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    )
    expect(strategy).toBeInstanceOf(WeightedRoundRobinWorkerChoiceStrategy)
  })

  it('Verify that getWorkerChoiceStrategy() throw error on unknown strategy', () => {
    expect(() => {
      getWorkerChoiceStrategy(pool, 'UNKNOWN_STRATEGY')
    }).toThrowError(
      new Error("Worker choice strategy 'UNKNOWN_STRATEGY' not found")
    )
  })
})
