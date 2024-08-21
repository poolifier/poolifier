import { expect } from 'expect'
import { createStubInstance, restore, stub } from 'sinon'

import {
  DynamicThreadPool,
  FixedThreadPool,
  WorkerChoiceStrategies,
} from '../../../lib/index.cjs'
import { FairShareWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/fair-share-worker-choice-strategy.cjs'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/interleaved-weighted-round-robin-worker-choice-strategy.cjs'
import { LeastBusyWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-busy-worker-choice-strategy.cjs'
import { LeastEluWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-elu-worker-choice-strategy.cjs'
import { LeastUsedWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-used-worker-choice-strategy.cjs'
import { RoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/round-robin-worker-choice-strategy.cjs'
import { WeightedRoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/weighted-round-robin-worker-choice-strategy.cjs'
import { WorkerChoiceStrategiesContext } from '../../../lib/pools/selection-strategies/worker-choice-strategies-context.cjs'

describe('Worker choice strategies context test suite', () => {
  const min = 1
  const max = 3
  let dynamicPool, fixedPool

  before('Create pools', () => {
    fixedPool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
    dynamicPool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
  })

  afterEach(() => {
    restore()
  })

  after('Destroy pools', async () => {
    await fixedPool.destroy()
    await dynamicPool.destroy()
  })

  it('Verify that constructor() initializes the context with the default choice strategy', () => {
    let workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    expect(workerChoiceStrategiesContext.workerChoiceStrategies.size).toBe(1)
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    expect(workerChoiceStrategiesContext.workerChoiceStrategies.size).toBe(1)
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
  })

  it('Verify that constructor() initializes the context with retries attribute properly set', () => {
    let workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    expect(workerChoiceStrategiesContext.retries).toBe(
      fixedPool.info.maxSize * 2
    )
    workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    expect(workerChoiceStrategiesContext.retries).toBe(
      dynamicPool.info.maxSize * 2
    )
  })

  it('Verify that execute() throws error if null or undefined is returned after retries', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    const workerChoiceStrategyUndefinedStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: stub().returns(undefined),
      }
    )
    workerChoiceStrategiesContext.workerChoiceStrategies.set(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
      workerChoiceStrategyUndefinedStub
    )
    expect(() => workerChoiceStrategiesContext.execute()).toThrow(
      new Error(
        `Worker node key chosen is null or undefined after ${workerChoiceStrategiesContext.retries} retries`
      )
    )
    const workerChoiceStrategyNullStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: stub().returns(null),
      }
    )
    workerChoiceStrategiesContext.workerChoiceStrategies.set(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
      workerChoiceStrategyNullStub
    )
    expect(() => workerChoiceStrategiesContext.execute()).toThrow(
      new Error(
        `Worker node key chosen is null or undefined after ${workerChoiceStrategiesContext.retries} retries`
      )
    )
  })

  it('Verify that execute() retry until a worker node is chosen', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    const workerChoiceStrategyStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: stub()
          .onCall(0)
          .returns(undefined)
          .onCall(1)
          .returns(undefined)
          .onCall(2)
          .returns(undefined)
          .onCall(3)
          .returns(undefined)
          .onCall(4)
          .returns(undefined)
          .returns(1),
      }
    )
    expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    workerChoiceStrategiesContext.workerChoiceStrategies.set(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
      workerChoiceStrategyStub
    )
    const chosenWorkerKey = workerChoiceStrategiesContext.execute()
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).choose.callCount
    ).toBe(6)
    expect(chosenWorkerKey).toBe(1)
  })

  it('Verify that execute() return the worker node key chosen by the strategy with fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    const workerChoiceStrategyStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: stub().returns(0),
      }
    )
    expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    workerChoiceStrategiesContext.workerChoiceStrategies.set(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
      workerChoiceStrategyStub
    )
    const chosenWorkerKey = workerChoiceStrategiesContext.execute()
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).choose.calledOnce
    ).toBe(true)
    expect(chosenWorkerKey).toBe(0)
  })

  it('Verify that execute() return the worker node key chosen by the strategy with dynamic pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    const workerChoiceStrategyStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: stub().returns(0),
      }
    )
    expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    workerChoiceStrategiesContext.workerChoiceStrategies.set(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
      workerChoiceStrategyStub
    )
    const chosenWorkerKey = workerChoiceStrategiesContext.execute()
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).choose.calledOnce
    ).toBe(true)
    expect(chosenWorkerKey).toBe(0)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with ROUND_ROBIN and dynamic pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with LEAST_USED and fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.LEAST_USED
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with LEAST_USED and dynamic pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.LEAST_USED
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with LEAST_BUSY and fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.LEAST_BUSY
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(LeastBusyWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with LEAST_BUSY and dynamic pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.LEAST_BUSY
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(LeastBusyWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with LEAST_ELU and fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.LEAST_ELU
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(LeastEluWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with LEAST_ELU and dynamic pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.LEAST_ELU
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(LeastEluWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with FAIR_SHARE and fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.FAIR_SHARE
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(FairShareWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with FAIR_SHARE and dynamic pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.FAIR_SHARE
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(FairShareWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(WeightedRoundRobinWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and dynamic pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(WeightedRoundRobinWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with INTERLEAVED_WEIGHTED_ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(InterleavedWeightedRoundRobinWorkerChoiceStrategy)
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with INTERLEAVED_WEIGHTED_ROUND_ROBIN and dynamic pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(InterleavedWeightedRoundRobinWorkerChoiceStrategy)
  })

  it('Verify that worker choice strategy options enable median runtime pool statistics', () => {
    const wwrWorkerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    let workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool,
      [wwrWorkerChoiceStrategy],
      {
        runTime: { median: true },
        waitTime: { median: true },
      }
    )
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
        .median
    ).toBe(true)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
        .median
    ).toBe(true)
    workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool,
      [wwrWorkerChoiceStrategy],
      {
        runTime: { median: true },
        waitTime: { median: true },
      }
    )
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
        .median
    ).toBe(true)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
        .median
    ).toBe(true)
    const fsWorkerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool,
      [fsWorkerChoiceStrategy],
      {
        runTime: { median: true },
        waitTime: { median: true },
      }
    )
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
        .median
    ).toBe(true)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
        .median
    ).toBe(true)
    workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool,
      [fsWorkerChoiceStrategy],
      {
        runTime: { median: true },
        waitTime: { median: true },
      }
    )
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
        .median
    ).toBe(true)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
        .median
    ).toBe(true)
  })
})
