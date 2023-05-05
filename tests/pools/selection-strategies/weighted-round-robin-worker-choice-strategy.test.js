const { expect } = require('expect')
const sinon = require('sinon')
const { FixedThreadPool } = require('../../../lib')
const {
  WeightedRoundRobinWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/weighted-round-robin-worker-choice-strategy')
const TestUtils = require('../../test-utils')

describe('Weighted round robin strategy worker choice strategy test suite', () => {
  // const min = 1
  const max = 3
  let pool

  before(() => {
    pool = new FixedThreadPool(max, './tests/worker-files/thread/testWorker.js')
  })

  afterEach(() => {
    sinon.restore()
  })

  after(async () => {
    await pool.destroy()
  })

  it('Verify that reset() resets internals', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    strategy.currentWorkerId = TestUtils.generateRandomInteger(
      Number.MAX_SAFE_INTEGER,
      1
    )
    strategy.workerVirtualTaskRunTime = TestUtils.generateRandomInteger(
      Number.MAX_SAFE_INTEGER,
      1
    )
    const resetResult = strategy.reset()
    expect(resetResult).toBe(true)
    expect(strategy.currentWorkerNodeId).toBe(0)
    expect(strategy.workerVirtualTaskRunTime).toBe(0)
  })
})
