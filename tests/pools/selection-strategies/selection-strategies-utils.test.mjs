import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FixedThreadPool, WorkerChoiceStrategies } from '../../../lib/index.mjs'
import { FairShareWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/fair-share-worker-choice-strategy.mjs'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/interleaved-weighted-round-robin-worker-choice-strategy.mjs'
import { LeastBusyWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-busy-worker-choice-strategy.mjs'
import { LeastEluWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-elu-worker-choice-strategy.mjs'
import { LeastUsedWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-used-worker-choice-strategy.mjs'
import { RoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/round-robin-worker-choice-strategy.mjs'
import { getWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/selection-strategies-utils.mjs'
import { WeightedRoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/weighted-round-robin-worker-choice-strategy.mjs'
import { WorkerChoiceStrategiesContext } from '../../../lib/pools/selection-strategies/worker-choice-strategies-context.mjs'

describe('Selection strategies utils test suite', () => {
  const numberOfThreads = 4
  let context, threadFixedPool

  beforeAll(() => {
    threadFixedPool = new FixedThreadPool(
      numberOfThreads,
      './tests/worker-files/thread/testWorker.mjs'
    )
    context = new WorkerChoiceStrategiesContext(threadFixedPool)
  })

  afterAll(async () => {
    // Skip on CI to avoid afterAll hook timeout
    if (process.env.CI != null) return
    await threadFixedPool.destroy()
  })

  it.each([
    [WorkerChoiceStrategies.FAIR_SHARE, FairShareWorkerChoiceStrategy],
    [
      WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN,
      InterleavedWeightedRoundRobinWorkerChoiceStrategy,
    ],
    [WorkerChoiceStrategies.LEAST_BUSY, LeastBusyWorkerChoiceStrategy],
    [WorkerChoiceStrategies.LEAST_ELU, LeastEluWorkerChoiceStrategy],
    [WorkerChoiceStrategies.LEAST_USED, LeastUsedWorkerChoiceStrategy],
    [WorkerChoiceStrategies.ROUND_ROBIN, RoundRobinWorkerChoiceStrategy],
    [
      WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
      WeightedRoundRobinWorkerChoiceStrategy,
    ],
  ])('Verify getWorkerChoiceStrategy() instantiates %s', (strategy, StrategyClass) => {
    expect(
      getWorkerChoiceStrategy(strategy, threadFixedPool, context)
    ).toBeInstanceOf(StrategyClass)
  })

  it('Verify getWorkerChoiceStrategy() throws on unknown strategy', () => {
    expect(() =>
      getWorkerChoiceStrategy('UNKNOWN', threadFixedPool, context)
    ).toThrow(new Error("Worker choice strategy 'UNKNOWN' is not valid"))
  })
})
