const { expect } = require('expect')
const sinon = require('sinon')
const { FixedThreadPool } = require('../../../lib/index')
const {
  WeightedRoundRobinWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/weighted-round-robin-worker-choice-strategy')

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

  it.only('Verify that reset() resets internals', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    const workersTaskRunTimeClearStub = sinon
      .stub(strategy.workersTaskRunTime, 'clear')
      .returns()
    const initWorkersTaskRunTimeStub = sinon
      .stub(strategy, 'initWorkersTaskRunTime')
      .returns()
    const resetResult = strategy.reset()
    expect(resetResult).toBe(true)
    expect(strategy.previousWorkerIndex).toBe(0)
    expect(strategy.currentWorkerIndex).toBe(0)
    expect(strategy.defaultWorkerWeight).toBeGreaterThan(0)
    expect(workersTaskRunTimeClearStub.calledOnce).toBe(true)
    expect(initWorkersTaskRunTimeStub.calledOnce).toBe(true)
  })
})
