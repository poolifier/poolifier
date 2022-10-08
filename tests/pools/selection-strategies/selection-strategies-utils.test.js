const { expect } = require('expect')
const sinon = require('sinon')
const {
  SelectionStrategiesUtils
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

describe('Selection strategies utils test suite', () => {
  let pool
  beforeEach(() => {
    pool = sinon.createStubInstance(FixedThreadPool)
  })

  afterEach(() => {
    sinon.restore()
  })

  it('Verify that getWorkerChoiceStrategy() default return ROUND_ROBIN strategy', () => {
    const strategy = SelectionStrategiesUtils.getWorkerChoiceStrategy(pool)
    expect(strategy).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
  })

  it('Verify that getWorkerChoiceStrategy() can return ROUND_ROBIN strategy', () => {
    const strategy = SelectionStrategiesUtils.getWorkerChoiceStrategy(
      pool,
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(strategy).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
  })

  it('Verify that getWorkerChoiceStrategy() can return LESS_RECENTLY_USED strategy', () => {
    const strategy = SelectionStrategiesUtils.getWorkerChoiceStrategy(
      pool,
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )
    expect(strategy).toBeInstanceOf(LessRecentlyUsedWorkerChoiceStrategy)
  })

  it('Verify that getWorkerChoiceStrategy() throw error on unknown strategy', () => {
    expect(() => {
      SelectionStrategiesUtils.getWorkerChoiceStrategy(pool, 'UNKNOWN_STRATEGY')
    }).toThrowError(
      new Error("Worker choice strategy 'UNKNOWN_STRATEGY' not found")
    )
  })
})
