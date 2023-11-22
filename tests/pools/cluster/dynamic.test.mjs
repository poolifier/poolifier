import { expect } from 'expect'
import { DynamicClusterPool, PoolEvents } from '../../../lib/index.js'
import { TaskFunctions } from '../../test-types.js'
import { sleep, waitWorkerEvents } from '../../test-utils.js'

describe('Dynamic cluster pool test suite', () => {
  const min = 1
  const max = 3
  const pool = new DynamicClusterPool(
    min,
    max,
    './tests/worker-files/cluster/testWorker.js',
    {
      errorHandler: e => console.error(e)
    }
  )

  it('Verify that the function is executed in a worker cluster', async () => {
    let result = await pool.execute({
      function: TaskFunctions.fibonacci
    })
    expect(result).toBe(75025)
    result = await pool.execute({
      function: TaskFunctions.factorial
    })
    expect(result).toBe(9.33262154439441e157)
  })

  it('Verify that new workers are created when required, max size is not exceeded and that after a while new workers will die', async () => {
    let poolBusy = 0
    pool.emitter.on(PoolEvents.busy, () => ++poolBusy)
    for (let i = 0; i < max * 2; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBeLessThanOrEqual(max)
    expect(pool.workerNodes.length).toBeGreaterThan(min)
    expect(poolBusy).toBe(1)
    const numberOfExitEvents = await waitWorkerEvents(pool, 'exit', max - min)
    expect(numberOfExitEvents).toBe(max - min)
  })

  it('Verify scale worker up and down is working', async () => {
    expect(pool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 2; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBeGreaterThan(min)
    await waitWorkerEvents(pool, 'exit', max - min)
    expect(pool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 2; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBeGreaterThan(min)
    await waitWorkerEvents(pool, 'exit', max - min)
    expect(pool.workerNodes.length).toBe(min)
  })

  it('Shutdown test', async () => {
    const exitPromise = waitWorkerEvents(pool, 'exit', min)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.busy])
    let poolDestroy = 0
    pool.emitter.on(PoolEvents.destroy, () => ++poolDestroy)
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.busy,
      PoolEvents.destroy
    ])
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(pool.started).toBe(false)
    expect(pool.readyEventEmitted).toBe(false)
    expect(pool.workerNodes.length).toBe(0)
    expect(numberOfExitEvents).toBe(min)
    expect(poolDestroy).toBe(1)
  })

  it('Validation of inputs test', () => {
    expect(() => new DynamicClusterPool(min)).toThrow(
      "Cannot find the worker file 'undefined'"
    )
  })

  it('Should work even without opts in input', async () => {
    const pool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/testWorker.js'
    )
    const result = await pool.execute()
    expect(result).toStrictEqual({ ok: 1 })
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify scale processes up and down is working when long executing task is used:hard', async () => {
    const longRunningPool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/longRunningWorkerHardBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.info('long executing worker is online'),
        exitHandler: () => console.info('long executing worker exited')
      }
    )
    expect(longRunningPool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 2; i++) {
      longRunningPool.execute()
    }
    expect(longRunningPool.workerNodes.length).toBe(max)
    await waitWorkerEvents(longRunningPool, 'exit', max - min)
    expect(longRunningPool.workerNodes.length).toBe(min)
    expect(
      longRunningPool.workerChoiceStrategyContext.workerChoiceStrategies.get(
        longRunningPool.workerChoiceStrategyContext.workerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeLessThan(longRunningPool.workerNodes.length)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
  })

  it('Verify scale processes up and down is working when long executing task is used:soft', async () => {
    const longRunningPool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/longRunningWorkerSoftBehavior.js',
      {
        errorHandler: e => console.error(e),
        onlineHandler: () => console.info('long executing worker is online'),
        exitHandler: () => console.info('long executing worker exited')
      }
    )
    expect(longRunningPool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 2; i++) {
      longRunningPool.execute()
    }
    expect(longRunningPool.workerNodes.length).toBe(max)
    await sleep(1000)
    // Here we expect the workerNodes to be at the max size since the task is still executing
    expect(longRunningPool.workerNodes.length).toBe(max)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
  })

  it('Verify that a pool with zero worker can be instantiated', async () => {
    const pool = new DynamicClusterPool(
      0,
      max,
      './tests/worker-files/cluster/testWorker.js'
    )
    expect(pool).toBeInstanceOf(DynamicClusterPool)
    // We need to clean up the resources after our test
    await pool.destroy()
  })
})
