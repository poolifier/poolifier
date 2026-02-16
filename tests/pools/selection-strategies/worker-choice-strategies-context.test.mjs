import { expect } from '@std/expect'
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
    ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
    workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    expect(workerChoiceStrategiesContext.workerChoiceStrategies.size).toBe(1)
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
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
      WorkerChoiceStrategies.LEAST_USED
    )
    const workerChoiceStrategyUndefinedStub =
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    stub(workerChoiceStrategyUndefinedStub, 'choose').returns(undefined)
    let err
    try {
      workerChoiceStrategiesContext.execute()
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe(
      `Worker node key chosen by ${workerChoiceStrategyUndefinedStub.name} is null or undefined after ${workerChoiceStrategyUndefinedStub.retriesCount.toString()} retries (max: ${workerChoiceStrategiesContext.retries.toString()})`
    )
    expect(workerChoiceStrategyUndefinedStub.choose.callCount).toBe(
      workerChoiceStrategyUndefinedStub.retriesCount + 1
    )
    expect(workerChoiceStrategiesContext.getStrategyRetries()).toBe(
      workerChoiceStrategyUndefinedStub.retriesCount
    )
    workerChoiceStrategyUndefinedStub.choose.restore()
    const workerChoiceStrategyNullStub =
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    stub(workerChoiceStrategyNullStub, 'choose').returns(null)
    err = undefined
    try {
      workerChoiceStrategiesContext.execute()
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe(
      `Worker node key chosen by ${workerChoiceStrategyNullStub.name} is null or undefined after ${workerChoiceStrategyNullStub.retriesCount.toString()} retries (max: ${workerChoiceStrategiesContext.retries.toString()})`
    )
    expect(workerChoiceStrategyNullStub.choose.callCount).toBe(
      workerChoiceStrategyNullStub.retriesCount + 1
    )
    expect(workerChoiceStrategiesContext.getStrategyRetries()).toBe(
      workerChoiceStrategyNullStub.retriesCount
    )
    workerChoiceStrategyNullStub.choose.restore()
  })

  it('Verify that execute() retry until a worker node is chosen', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LEAST_USED
    )
    const workerChoiceStrategyStub =
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    stub(workerChoiceStrategyStub, 'choose')
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
      .returns(1)
    const chosenWorkerKey = workerChoiceStrategiesContext.execute()
    expect(workerChoiceStrategyStub.choose.callCount).toBe(6)
    expect(workerChoiceStrategiesContext.getStrategyRetries()).toBe(5)
    expect(chosenWorkerKey).toBe(1)
    workerChoiceStrategyStub.choose.restore()
  })

  it('Verify that execute() return the worker node key chosen by the strategy with fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LEAST_USED
    )
    const workerChoiceStrategyStub =
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    stub(workerChoiceStrategyStub, 'choose').returns(0)
    const chosenWorkerKey = workerChoiceStrategiesContext.execute()
    expect(workerChoiceStrategyStub.choose.calledOnce).toBe(true)
    expect(workerChoiceStrategiesContext.getStrategyRetries()).toBe(0)
    expect(chosenWorkerKey).toBe(0)
    workerChoiceStrategyStub.choose.restore()
  })

  it('Verify that execute() return the worker node key chosen by the strategy with dynamic pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      dynamicPool
    )
    expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
      WorkerChoiceStrategies.LEAST_USED
    )
    const workerChoiceStrategyStub =
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    stub(workerChoiceStrategyStub, 'choose').returns(0)
    const chosenWorkerKey = workerChoiceStrategiesContext.execute()
    expect(workerChoiceStrategyStub.choose.calledOnce).toBe(true)
    expect(workerChoiceStrategiesContext.getStrategyRetries()).toBe(0)
    expect(chosenWorkerKey).toBe(0)
    workerChoiceStrategyStub.choose.restore()
  })

  it('Verify that setDefaultWorkerChoiceStrategy() works with ROUND_ROBIN and fixed pool', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      )
    ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
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
    ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
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

  it('Verify that execute() passes workerNodeKeysSet to strategy choose()', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    const workerChoiceStrategyStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: stub().returns(1),
      }
    )
    workerChoiceStrategiesContext.workerChoiceStrategies.set(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
      workerChoiceStrategyStub
    )
    const workerNodeKeys = [1, 2]
    const chosenWorkerKey = workerChoiceStrategiesContext.execute(
      undefined,
      new Set(workerNodeKeys)
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).choose.calledOnce
    ).toBe(true)
    // Verify it was called with a Set containing the same elements
    const callArg = workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
    ).choose.firstCall.args[0]
    expect(callArg).toBeInstanceOf(Set)
    expect([...callArg]).toStrictEqual(workerNodeKeys)
    expect(chosenWorkerKey).toBe(1)
  })

  it('Verify that execute() with workerNodeKeys affinity filters worker selection', () => {
    const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
      fixedPool
    )
    // Stub returns the first valid key from workerNodeKeysSet
    const workerChoiceStrategyStub = createStubInstance(
      RoundRobinWorkerChoiceStrategy,
      {
        choose: stub().callsFake(workerNodeKeysSet => {
          if (workerNodeKeysSet != null && workerNodeKeysSet.size > 0) {
            return [...workerNodeKeysSet][0]
          }
          return 0
        }),
      }
    )
    workerChoiceStrategiesContext.workerChoiceStrategies.set(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
      workerChoiceStrategyStub
    )
    // Test with specific worker node affinity
    const workerNodeKeys = [2]
    const chosenWorkerKey = workerChoiceStrategiesContext.execute(
      undefined,
      new Set(workerNodeKeys)
    )
    expect(chosenWorkerKey).toBe(2)
    // Verify it was called with a Set containing the same elements
    const callArg = workerChoiceStrategiesContext.workerChoiceStrategies.get(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
    ).choose.firstCall.args[0]
    expect(callArg).toBeInstanceOf(Set)
    expect([...callArg]).toStrictEqual(workerNodeKeys)
  })

  it('Verify that execute() retries with workerNodes until valid worker found', () => {
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
          .returns(1),
      }
    )
    workerChoiceStrategiesContext.workerChoiceStrategies.set(
      workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
      workerChoiceStrategyStub
    )
    const chosenWorkerKey = workerChoiceStrategiesContext.execute(
      undefined,
      new Set([0, 1, 2])
    )
    expect(
      workerChoiceStrategiesContext.workerChoiceStrategies.get(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy
      ).choose.callCount
    ).toBe(3)
    expect(chosenWorkerKey).toBe(1)
  })
})
