import { expect } from '@std/expect'

import {
  DynamicClusterPool,
  PoolEvents,
  WorkerChoiceStrategies,
} from '../../../lib/index.cjs'
import { TaskFunctions } from '../../test-types.cjs'
import { sleep, waitPoolEvents, waitWorkerEvents } from '../../test-utils.cjs'

describe('Dynamic cluster pool test suite', () => {
  const min = 1
  const max = 3
  let pool

  before('Create pool', () => {
    pool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/testWorker.cjs',
      {
        errorHandler: e => console.error(e),
      }
    )
  })

  it('Verify that the function is executed in a worker cluster', async () => {
    let result = await pool.execute(
      {
        function: TaskFunctions.fibonacci,
      },
      'default',
      AbortSignal.timeout(2000)
    )
    expect(result).toBe(354224848179262000000)
    result = await pool.execute(
      {
        function: TaskFunctions.factorial,
      },
      'default',
      AbortSignal.timeout(2000)
    )
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
    expect(pool.workerNodes.length).toBe(min)
  })

  it('Verify scale worker up and down is working', async () => {
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
      PoolEvents.destroy,
    ])
    await pool.destroy()
    const numberOfExitEvents = await exitPromise
    expect(pool.info.started).toBe(false)
    expect(pool.info.ready).toBe(false)
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.busy,
      PoolEvents.destroy,
    ])
    expect(pool.readyEventEmitted).toBe(false)
    expect(pool.emptyEventEmitted).toBe(false)
    expect(pool.fullEventEmitted).toBe(false)
    expect(pool.busyEventEmitted).toBe(false)
    expect(pool.backPressureEventEmitted).toBe(false)
    expect(pool.workerNodes.length).toBe(0)
    expect(numberOfExitEvents).toBe(min)
    expect(poolDestroy).toBe(1)
  })

  it('Validation of inputs test', () => {
    expect(() => new DynamicClusterPool(min)).toThrow(
      'The worker file path must be specified'
    )
  })

  it('Verify scale processes up and down is working when long executing task is used:hard', async () => {
    const longRunningPool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/longRunningWorkerHardBehavior.cjs',
      {
        errorHandler: e => console.error(e),
        exitHandler: () => console.info('long executing worker exited'),
        onlineHandler: () => console.info('long executing worker is online'),
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
      longRunningPool.workerChoiceStrategiesContext.workerChoiceStrategies.get(
        longRunningPool.workerChoiceStrategiesContext
          .defaultWorkerChoiceStrategy
      ).nextWorkerNodeKey
    ).toBeLessThan(longRunningPool.workerNodes.length)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
  })

  it('Verify scale processes up and down is working when long executing task is used:soft', async () => {
    const longRunningPool = new DynamicClusterPool(
      min,
      max,
      './tests/worker-files/cluster/longRunningWorkerSoftBehavior.cjs',
      {
        errorHandler: e => console.error(e),
        exitHandler: () => console.info('long executing worker exited'),
        onlineHandler: () => console.info('long executing worker is online'),
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
      './tests/worker-files/cluster/testWorker.cjs'
    )
    expect(pool).toBeInstanceOf(DynamicClusterPool)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify that a pool with zero worker works', async () => {
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      const pool = new DynamicClusterPool(
        0,
        max,
        './tests/worker-files/cluster/testWorker.cjs',
        {
          startWorkers: false,
          workerChoiceStrategy,
        }
      )
      for (let run = 0; run < 2; run++) {
        expect(pool.info.started).toBe(false)
        expect(pool.info.ready).toBe(false)
        pool.start()
        expect(pool.info.started).toBe(true)
        expect(pool.info.ready).toBe(true)
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        run % 2 !== 0 && pool.enableTasksQueue(true)
        const maxMultiplier = 4
        const promises = new Set()
        expect(pool.workerNodes.length).toBe(pool.info.minSize)
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        expect(pool.workerNodes.length).toBeGreaterThan(pool.info.minSize)
        expect(pool.workerNodes.length).toBeLessThanOrEqual(pool.info.maxSize)
        await waitPoolEvents(pool, PoolEvents.empty, 1)
        expect(pool.workerNodes.length).toBe(pool.info.minSize)
        // We need to clean up the resources after our test
        await pool.destroy()
      }
    }
  })
})
