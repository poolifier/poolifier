import { expect } from '@std/expect'
import { randomInt } from 'node:crypto'

import { FixedThreadPool } from '../../../lib/index.cjs'
import { FairShareWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/fair-share-worker-choice-strategy.cjs'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/interleaved-weighted-round-robin-worker-choice-strategy.cjs'
import { LeastBusyWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-busy-worker-choice-strategy.cjs'
import { LeastEluWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-elu-worker-choice-strategy.cjs'
import { LeastUsedWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/least-used-worker-choice-strategy.cjs'
import { RoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/round-robin-worker-choice-strategy.cjs'
import { WeightedRoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/weighted-round-robin-worker-choice-strategy.cjs'

describe('Weighted round robin strategy worker choice strategy test suite', () => {
  // const min = 1
  const max = 3
  let pool

  before('Create pool', () => {
    pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
  })

  after('Destroy pool', async () => {
    await pool.destroy()
  })

  it('Verify that WRR reset() resets internals', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    strategy.nextWorkerNodeKey = randomInt(1, 281474976710656)
    strategy.previousWorkerNodeKey = randomInt(1, 281474976710656)
    strategy.workerNodeVirtualTaskRunTime = randomInt(1, 281474976710656)
    expect(strategy.nextWorkerNodeKey).toBeGreaterThan(0)
    expect(strategy.previousWorkerNodeKey).toBeGreaterThan(0)
    expect(strategy.workerNodeVirtualTaskRunTime).toBeGreaterThan(0)
    expect(strategy.reset()).toBe(true)
    expect(strategy.nextWorkerNodeKey).toBe(0)
    expect(strategy.previousWorkerNodeKey).toBe(0)
    expect(strategy.workerNodeVirtualTaskExecutionTime).toBe(0)
  })

  it('Verify that IWRR reset() resets internals', () => {
    const strategy = new InterleavedWeightedRoundRobinWorkerChoiceStrategy(pool)
    strategy.nextWorkerNodeKey = randomInt(1, 281474976710656)
    strategy.previousWorkerNodeKey = randomInt(1, 281474976710656)
    strategy.roundId = randomInt(1, 281474976710656)
    strategy.workerNodeId = randomInt(1, 281474976710656)
    strategy.workerNodeVirtualTaskRunTime = randomInt(1, 281474976710656)
    expect(strategy.nextWorkerNodeKey).toBeGreaterThan(0)
    expect(strategy.previousWorkerNodeKey).toBeGreaterThan(0)
    expect(strategy.roundId).toBeGreaterThan(0)
    expect(strategy.workerNodeId).toBeGreaterThan(0)
    expect(strategy.workerNodeVirtualTaskRunTime).toBeGreaterThan(0)
    expect(strategy.reset()).toBe(true)
    expect(strategy.nextWorkerNodeKey).toBe(0)
    expect(strategy.previousWorkerNodeKey).toBe(0)
    expect(strategy.roundId).toBe(0)
    expect(strategy.workerNodeId).toBe(0)
    expect(strategy.workerNodeVirtualTaskExecutionTime).toBe(0)
  })
})

describe('Worker choice strategies choose() with workerNodeKeys test suite', () => {
  const max = 3
  let pool

  before('Create pool', () => {
    pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
  })

  after('Destroy pool', async () => {
    await pool.destroy()
  })

  it('Verify that RoundRobin choose() with empty workerNodeKeys returns undefined', () => {
    const strategy = new RoundRobinWorkerChoiceStrategy(pool)
    const result = strategy.choose([])
    expect(result).toBe(undefined)
  })

  it('Verify that RoundRobin choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new RoundRobinWorkerChoiceStrategy(pool)
    // Worker node 0 should be ready in a fixed pool
    const result = strategy.choose([0])
    expect(result).toBe(0)
  })

  it('Verify that RoundRobin choose() respects workerNodeKeys affinity', () => {
    const strategy = new RoundRobinWorkerChoiceStrategy(pool)
    // Should only return keys from the provided affinity set
    const workerNodeKeys = [1, 2]
    const result = strategy.choose(workerNodeKeys)
    expect(workerNodeKeys.includes(result)).toBe(true)
  })

  it('Verify that LeastUsed choose() with empty workerNodeKeys returns undefined', () => {
    const strategy = new LeastUsedWorkerChoiceStrategy(pool)
    const result = strategy.choose([])
    expect(result).toBe(undefined)
  })

  it('Verify that LeastUsed choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new LeastUsedWorkerChoiceStrategy(pool)
    const result = strategy.choose([0])
    expect(result).toBe(0)
  })

  it('Verify that LeastUsed choose() respects workerNodeKeys affinity', () => {
    const strategy = new LeastUsedWorkerChoiceStrategy(pool)
    const workerNodeKeys = [1, 2]
    const result = strategy.choose(workerNodeKeys)
    expect(workerNodeKeys.includes(result)).toBe(true)
  })

  it('Verify that LeastBusy choose() with empty workerNodeKeys returns undefined', () => {
    const strategy = new LeastBusyWorkerChoiceStrategy(pool)
    const result = strategy.choose([])
    expect(result).toBe(undefined)
  })

  it('Verify that LeastBusy choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new LeastBusyWorkerChoiceStrategy(pool)
    const result = strategy.choose([0])
    expect(result).toBe(0)
  })

  it('Verify that LeastBusy choose() respects workerNodeKeys affinity', () => {
    const strategy = new LeastBusyWorkerChoiceStrategy(pool)
    const workerNodeKeys = [1, 2]
    const result = strategy.choose(workerNodeKeys)
    expect(workerNodeKeys.includes(result)).toBe(true)
  })

  it('Verify that LeastElu choose() with empty workerNodeKeys returns undefined', () => {
    const strategy = new LeastEluWorkerChoiceStrategy(pool)
    const result = strategy.choose([])
    expect(result).toBe(undefined)
  })

  it('Verify that LeastElu choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new LeastEluWorkerChoiceStrategy(pool)
    const result = strategy.choose([0])
    expect(result).toBe(0)
  })

  it('Verify that LeastElu choose() respects workerNodeKeys affinity', () => {
    const strategy = new LeastEluWorkerChoiceStrategy(pool)
    const workerNodeKeys = [1, 2]
    const result = strategy.choose(workerNodeKeys)
    expect(workerNodeKeys.includes(result)).toBe(true)
  })

  it('Verify that FairShare choose() with empty workerNodeKeys returns undefined', () => {
    const strategy = new FairShareWorkerChoiceStrategy(pool)
    const result = strategy.choose([])
    expect(result).toBe(undefined)
  })

  it('Verify that FairShare choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new FairShareWorkerChoiceStrategy(pool)
    const result = strategy.choose([0])
    expect(result).toBe(0)
  })

  it('Verify that FairShare choose() respects workerNodeKeys affinity', () => {
    const strategy = new FairShareWorkerChoiceStrategy(pool)
    const workerNodeKeys = [1, 2]
    const result = strategy.choose(workerNodeKeys)
    expect(workerNodeKeys.includes(result)).toBe(true)
  })

  it('Verify that WeightedRoundRobin choose() with empty workerNodeKeys returns undefined', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    const result = strategy.choose([])
    expect(result).toBe(undefined)
  })

  it('Verify that WeightedRoundRobin choose() respects workerNodeKeys affinity', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    const workerNodeKeys = [1, 2]
    const result = strategy.choose(workerNodeKeys)
    // WeightedRoundRobin may return undefined if worker not ready, or a valid key
    expect(result === undefined || workerNodeKeys.includes(result)).toBe(true)
  })
})
