import { expect } from 'expect'
import { createStubInstance, restore, stub } from 'sinon'
import {
  DynamicThreadPool,
  FixedThreadPool,
  WorkerChoiceStrategies
} from '../../../lib/index.cjs'
import { WorkerChoiceStrategyContext } from '../../../lib/pools/selection-strategies/worker-choice-strategy-context.cjs'
import { RoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/round-robin-worker-choice-strategy.cjs'
import { LeastUsedWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-used-worker-choice-strategy.cjs'
import { LeastBusyWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-busy-worker-choice-strategy.cjs'
import { LeastEluWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-elu-worker-choice-strategy.cjs'
import { FairShareWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/fair-share-worker-choice-strategy.cjs'
import { WeightedRoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/weighted-round-robin-worker-choice-strategy.cjs'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/interleaved-weighted-round-robin-worker-choice-strategy.cjs'

describe('Worker choice strategy context test suite', () => {
  const min = 1
  const max = 3
  let fixedPool, dynamicPool

  before(() => {
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

  after(async () => {
    await fixedPool.destroy()
    await dynamicPool.destroy()
  })

  it('Verify that constructor() initializes the context with all the available worker choice strategies', () => {
    let workerChoiceStrategyContext = new WorkerChoiceStrategyContext(fixedPool)
    expect(workerChoiceStrategyContext.workerChoiceStrategies.size).toBe(
      Object.keys(WorkerChoiceStrategies).length
    )
    workerChoiceStrategyContext = new WorkerChoiceStrategyContext(dynamicPool)
    expect(workerChoiceStrategyContext.workerChoiceStrategies.size).toBe(
      Object.keys(WorkerChoiceStrategies).length
    )
  })

  it('Verify that constructor() initializes the context with retries attribute properly set', () => {
    let workerChoiceStrategyContext = new WorkerChoiceStrategyContext(fixedPool)
    expect(workerChoiceStrategyContext.retries).toBe(fixedPool.info.maxSize * 2)
    workerChoiceStrategyContext = new WorkerChoiceStrategyContext(dynamicPool)
    expect(workerChoiceStrategyContext.retries).toBe(
      dynamicPool.info.maxSize * 2
    )
  })

  it('Verify that execute() return the worker node key chosen by the strategy with fixed pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    const workerChoiceStrategyStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        hasPoolWorkerNodesReady: stub().returns(true),
        choose: stub().returns(0)
      }
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    workerChoiceStrategyContext.workerChoiceStrategies.set(
      workerChoiceStrategyContext.workerChoiceStrategy,
      workerChoiceStrategyStub
    )
    const chosenWorkerKey = workerChoiceStrategyContext.execute()
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategyContext.workerChoiceStrategy
      ).choose.calledOnce
    ).toBe(true)
    expect(chosenWorkerKey).toBe(0)
  })

  it('Verify that execute() throws error if null or undefined is returned after retries', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    const workerChoiceStrategyUndefinedStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        hasPoolWorkerNodesReady: stub().returns(true),
        choose: stub().returns(undefined)
      }
    )
    workerChoiceStrategyContext.workerChoiceStrategies.set(
      workerChoiceStrategyContext.workerChoiceStrategy,
      workerChoiceStrategyUndefinedStub
    )
    expect(() => workerChoiceStrategyContext.execute()).toThrow(
      new Error(
        `Worker node key chosen is null or undefined after ${workerChoiceStrategyContext.retries} retries`
      )
    )
    const workerChoiceStrategyNullStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        hasPoolWorkerNodesReady: stub().returns(true),
        choose: stub().returns(null)
      }
    )
    workerChoiceStrategyContext.workerChoiceStrategies.set(
      workerChoiceStrategyContext.workerChoiceStrategy,
      workerChoiceStrategyNullStub
    )
    expect(() => workerChoiceStrategyContext.execute()).toThrow(
      new Error(
        `Worker node key chosen is null or undefined after ${workerChoiceStrategyContext.retries} retries`
      )
    )
  })

  it('Verify that execute() retry until a worker node is ready and chosen', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    const workerChoiceStrategyStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        hasPoolWorkerNodesReady: stub()
          .onCall(0)
          .returns(false)
          .onCall(1)
          .returns(false)
          .onCall(2)
          .returns(false)
          .onCall(3)
          .returns(false)
          .onCall(4)
          .returns(false)
          .returns(true),
        choose: stub().returns(1)
      }
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    workerChoiceStrategyContext.workerChoiceStrategies.set(
      workerChoiceStrategyContext.workerChoiceStrategy,
      workerChoiceStrategyStub
    )
    const chosenWorkerKey = workerChoiceStrategyContext.execute()
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategyContext.workerChoiceStrategy
      ).hasPoolWorkerNodesReady.callCount
    ).toBe(6)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategyContext.workerChoiceStrategy
      ).choose.callCount
    ).toBe(1)
    expect(chosenWorkerKey).toBe(1)
  })

  it('Verify that execute() throws error if worker choice strategy recursion reach the maximum depth', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    const workerChoiceStrategyStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        hasPoolWorkerNodesReady: stub().returns(false),
        choose: stub().returns(0)
      }
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    workerChoiceStrategyContext.workerChoiceStrategies.set(
      workerChoiceStrategyContext.workerChoiceStrategy,
      workerChoiceStrategyStub
    )
    expect(() => workerChoiceStrategyContext.execute()).toThrow(
      new RangeError('Maximum call stack size exceeded')
    )
  })

  it('Verify that execute() return the worker node key chosen by the strategy with dynamic pool', () => {
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    const workerChoiceStrategyStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        hasPoolWorkerNodesReady: stub().returns(true),
        choose: stub().returns(0)
      }
    )
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      WorkerChoiceStrategies.ROUND_ROBIN
    )
    workerChoiceStrategyContext.workerChoiceStrategies.set(
      workerChoiceStrategyContext.workerChoiceStrategy,
      workerChoiceStrategyStub
    )
    const chosenWorkerKey = workerChoiceStrategyContext.execute()
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategyContext.workerChoiceStrategy
      ).choose.calledOnce
    ).toBe(true)
    expect(chosenWorkerKey).toBe(0)
  })

  it('Verify that setWorkerChoiceStrategy() works with ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with ROUND_ROBIN and dynamic pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LEAST_USED and fixed pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LEAST_USED and dynamic pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LEAST_BUSY and fixed pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(LeastBusyWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LEAST_BUSY and dynamic pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(LeastBusyWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LEAST_ELU and fixed pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(LeastEluWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with LEAST_ELU and dynamic pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(LeastEluWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with FAIR_SHARE and fixed pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(FairShareWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with FAIR_SHARE and dynamic pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(FairShareWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(WeightedRoundRobinWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and dynamic pool', () => {
    const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(WeightedRoundRobinWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with INTERLEAVED_WEIGHTED_ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategy =
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(InterleavedWeightedRoundRobinWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that setWorkerChoiceStrategy() works with INTERLEAVED_WEIGHTED_ROUND_ROBIN and dynamic pool', () => {
    const workerChoiceStrategy =
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
    const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool
    )
    workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
    expect(
      workerChoiceStrategyContext.workerChoiceStrategies.get(
        workerChoiceStrategy
      )
    ).toBeInstanceOf(InterleavedWeightedRoundRobinWorkerChoiceStrategy)
    expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
      workerChoiceStrategy
    )
  })

  it('Verify that worker choice strategy options enable median runtime pool statistics', () => {
    const wwrWorkerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
    let workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool,
      wwrWorkerChoiceStrategy,
      {
        runTime: { median: true }
      }
    )
    expect(
      workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime.median
    ).toBe(true)
    workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool,
      wwrWorkerChoiceStrategy,
      {
        runTime: { median: true }
      }
    )
    expect(
      workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime.median
    ).toBe(true)
    const fsWorkerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
    workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      fixedPool,
      fsWorkerChoiceStrategy,
      {
        runTime: { median: true }
      }
    )
    expect(
      workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime.median
    ).toBe(true)
    workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
      dynamicPool,
      fsWorkerChoiceStrategy,
      {
        runTime: { median: true }
      }
    )
    expect(
      workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
        .average
    ).toBe(false)
    expect(
      workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime.median
    ).toBe(true)
  })
})
