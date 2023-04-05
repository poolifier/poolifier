const { expect } = require('expect')
const sinon = require('sinon')
const {
  FixedThreadPool,
  DynamicThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const {
  WorkerChoiceStrategyContext
} = require('../../../lib/pools/selection-strategies/worker-choice-strategy-context')
const {
  RoundRobinWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/round-robin-worker-choice-strategy')
const {
  LessUsedWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/less-used-worker-choice-strategy')
const {
  LessBusyWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/less-busy-worker-choice-strategy')
const {
  FairShareWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/fair-share-worker-choice-strategy')
const {
  WeightedRoundRobinWorkerChoiceStrategy
} = require('../../../lib/pools/selection-strategies/weighted-round-robin-worker-choice-strategy')

describe('Worker choice strategy context test suite', () => {
  const min = 1
  const max = 3
  let fixedPool, dynamicPool

  before(() => {
    fixedPool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.js'
    )
    dynamicPool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.js'
    )
  })

  afterEach(() => {
    sinon.restore()
  })

  after(async () => {
    await fixedPool.destroy()
    await dynamicPool.destroy()
  })

  it('Verify that execute() return the worker chosen by the strategy with fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    const WorkerChoiceStrategyStub = sinon.createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: sinon.stub().returns(0)
      }
    )
    workerChoiceStrategyContext.workerChoiceStrategy = WorkerChoiceStrategyStub
    const chosenWorkerKey = workerChoiceStrategyContext.execute()
    expect(
      workerChoiceStrategyContext.workerChoiceStrategy.choose.calledOnce
    ).toBe(true)
    expect(chosenWorkerKey).toBe(0)
  })

  it('Verify that execute() return the worker chosen by the strategy with dynamic pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    const WorkerChoiceStrategyStub = sinon.createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: sinon.stub().returns(0)
      }
    )
    workerChoiceStrategyContext.workerChoiceStrategy = WorkerChoiceStrategyStub
    const chosenWorkerKey = workerChoiceStrategyContext.execute()
    expect(
      workerChoiceStrategyContext.workerChoiceStrategy.choose.calledOnce
    ).toBe(true)
    expect(chosenWorkerKey).toBe(0)
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

  it('Verify that setWorkerChoiceStrategy() works with ROUND_ROBIN and dynamic pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      RoundRobinWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LESS_USED and fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.LESS_USED
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      LessUsedWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LESS_USED and dynamic pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.LESS_USED
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      LessUsedWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LESS_BUSY and fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.LESS_BUSY
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      LessBusyWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LESS_BUSY and dynamic pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.LESS_BUSY
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      LessBusyWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with FAIR_SHARE and fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.FAIR_SHARE
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      FairShareWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with FAIR_SHARE and dynamic pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.FAIR_SHARE
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      FairShareWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      WeightedRoundRobinWorkerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and dynamic pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBeInstanceOf(
      WeightedRoundRobinWorkerChoiceStrategy
    )
  })
})
