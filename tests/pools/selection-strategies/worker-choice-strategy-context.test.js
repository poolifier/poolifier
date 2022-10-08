const { expect } = require('expect')
const sinon = require('sinon')
const {
  FixedThreadPool,
  DynamicThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const {
  RoundRobinWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/round-robin-worker-choice-strategy')
const {
  LessRecentlyUsedWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/less-recently-used-worker-choice-strategy')
const {
  WorkerChoiceStrategyContext
} = require('../../../lib/pools/selection-strategies/worker-choice-strategy-context')
const {
  DynamicPoolWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/dynamic-pool-worker-choice-strategy')

describe('Worker choice strategy context test suite', () => {
  let fixedPool, dynamicPool
  beforeEach(() => {
    fixedPool = sinon.createStubInstance(FixedThreadPool)
    dynamicPool = sinon.createStubInstance(DynamicThreadPool)
  })

  afterEach(() => {
    sinon.restore()
  })

  it('Verify that execute() return the worker chosen by the strategy with fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    const WorkerChoiceStrategyStub = sinon.createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: sinon.stub().returns('worker')
      }
    )
    workerChoiceStrategyContext.workerChoiceStrategy = WorkerChoiceStrategyStub
    const worker = workerChoiceStrategyContext.execute()
    expect(
      workerChoiceStrategyContext.workerChoiceStrategy.choose.calledOnce
    ).toBe(true)
    expect(worker).toBe('worker')
  })

  it('Verify that execute() return the worker chosen by the strategy with dynamic pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    const WorkerChoiceStrategyStub = sinon.createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: sinon.stub().returns('worker')
      }
    )
    workerChoiceStrategyContext.workerChoiceStrategy = WorkerChoiceStrategyStub
    const worker = workerChoiceStrategyContext.execute()
    expect(
      workerChoiceStrategyContext.workerChoiceStrategy.choose.calledOnce
    ).toBe(true)
    expect(worker).toBe('worker')
  })

  it('Verify that setWorkerChoiceStrategy() works with ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      RoundRobinWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      DynamicPoolWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LESS_RECENTLY_USED and fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      LessRecentlyUsedWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LESS_RECENTLY_USED and fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.LESS_RECENTLY_USED
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      DynamicPoolWorkerChoiceStrategy
    )
  })
})
