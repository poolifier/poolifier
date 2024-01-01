import { randomInt } from 'node:crypto'
import { expect } from 'expect'
import { FixedThreadPool } from '../../../lib/index.cjs'
import { WeightedRoundRobinWorkerChoiceStrategy } from '../../../lib/pools/selection-strategies/weighted-round-robin-worker-choice-strategy.cjs'

describe('Weighted round robin strategy worker choice strategy test suite', () => {
  // const min = 1
  const max = 3
  let pool

  before(() => {
    pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
  })

  after(async () => {
    await pool.destroy()
  })

  it('Verify that reset() resets internals', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    strategy.currentWorkerId = randomInt(281474976710655)
    strategy.workerVirtualTaskRunTime = randomInt(281474976710655)
    expect(strategy.reset()).toBe(true)
    expect(strategy.nextWorkerNodeKey).toBe(0)
    expect(strategy.previousWorkerNodeKey).toBe(0)
    expect(strategy.workerNodeVirtualTaskRunTime).toBe(0)
  })
})
