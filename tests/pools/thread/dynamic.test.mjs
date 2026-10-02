import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  DynamicThreadPool,
  PoolEvents,
  WorkerChoiceStrategies,
  WorkerTerminationError,
} from '../../../lib/index.mjs'
import { TaskFunctions } from '../../test-types.cjs'
import { sleep, waitPoolEvents, waitWorkerEvents } from '../../test-utils.cjs'

describe('Dynamic thread pool test suite', () => {
  const min = 1
  const max = 3
  let pool

  beforeAll(() => {
    pool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/testWorker.mjs',
      {
        errorHandler: e => console.error(e),
      }
    )
  })

  afterAll(async () => {
    // Skip on CI to avoid afterAll hook timeout
    if (process.env.CI != null) return
    if (pool.info.started && !pool.destroying) {
      await pool.destroy()
    }
  })

  it('Verify that the function is executed in a worker thread', async () => {
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
    expect(poolBusy).toBe(0)
    const exitEvents = await waitWorkerEvents(pool, 'exit', max - min)
    expect(exitEvents).toBe(max - min)
    expect(pool.workerNodes.length).toBe(min)
  })

  it('Verify scale thread up and down is working', async () => {
    for (let i = 0; i < max * 2; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBe(max)
    let exitEvents = await waitWorkerEvents(pool, 'exit', max - min)
    expect(exitEvents).toBe(max - min)
    expect(pool.workerNodes.length).toBe(min)
    for (let i = 0; i < max * 2; i++) {
      pool.execute()
    }
    expect(pool.workerNodes.length).toBe(max)
    exitEvents = await waitWorkerEvents(pool, 'exit', max - min)
    expect(exitEvents).toBe(max - min)
    expect(pool.workerNodes.length).toBe(min)
  })

  it('emits busy only after every ready thread reaches queue concurrency', async () => {
    const concurrencyPool = new DynamicThreadPool(
      1,
      2,
      './tests/worker-files/thread/longRunningWorkerSoftBehavior.mjs',
      {
        enableTasksQueue: true,
        tasksQueueOptions: { concurrency: 2 },
      }
    )
    await waitPoolEvents(concurrencyPool, PoolEvents.ready, 1)
    await concurrencyPool.addTaskFunction(
      'delayedResult',
      async data =>
        await new Promise(resolve => setTimeout(() => resolve(data), 1000))
    )
    const busyEvents = []
    concurrencyPool.emitter.on(PoolEvents.busy, info => {
      busyEvents.push(info)
    })

    const taskPromises = Array.from({ length: 2 }, () =>
      concurrencyPool.execute(undefined, 'delayedResult')
    )

    expect(concurrencyPool.workerNodes).toHaveLength(2)
    expect(busyEvents).toHaveLength(0)
    await expect
      .poll(() =>
        concurrencyPool.workerNodes.every(workerNode => workerNode.info.ready)
      )
      .toBe(true)
    const busyEventPromise = waitPoolEvents(concurrencyPool, PoolEvents.busy, 1)
    taskPromises.push(
      concurrencyPool.execute(undefined, 'delayedResult'),
      concurrencyPool.execute(undefined, 'delayedResult')
    )
    await busyEventPromise
    expect(busyEvents).toHaveLength(1)
    expect(busyEvents[0].busyWorkerNodes).toBe(2)
    expect(busyEvents[0].executingTasks).toBe(4)
    await Promise.all(taskPromises)
    await concurrencyPool.destroy()
  })

  it('Shutdown test', { retry: 0 }, async ({ skip }) => {
    if (process.env.CI != null) {
      skip()
      return
    }
    const exitPromise = waitWorkerEvents(pool, 'exit', min)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.busy])
    let poolDestroy = 0
    pool.emitter.on(PoolEvents.destroy, () => ++poolDestroy)
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.busy,
      PoolEvents.destroy,
    ])
    await pool.destroy()
    const exitEvents = await exitPromise
    expect(pool.info.started).toBe(false)
    expect(pool.info.ready).toBe(false)
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.busy,
      PoolEvents.destroy,
    ])
    expect(pool.emptyEventEmitted).toBe(false)
    expect(pool.fullEventEmitted).toBe(false)
    expect(pool.workerNodes.length).toBe(0)
    expect(exitEvents).toBe(min)
    expect(poolDestroy).toBe(1)
  })

  it('Validation of inputs test', () => {
    expect(() => new DynamicThreadPool(min)).toThrow(
      'The worker file path must be defined'
    )
  })

  it('Verify scale thread up and down is working when long executing task is used:hard', async () => {
    const exitEvents = Promise.withResolvers()
    let exitEventCount = 0
    const longRunningPool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/longRunningWorkerHardBehavior.mjs',
      {
        errorHandler: e => console.error(e),
        exitHandler: () => {
          console.info('long executing worker exited')
          if (++exitEventCount === max - min) exitEvents.resolve(exitEventCount)
        },
        onlineHandler: () => console.info('long executing worker is online'),
      }
    )
    expect(longRunningPool.workerNodes.length).toBe(min)
    const taskPromises = Array.from({ length: max * 2 }, () =>
      longRunningPool.execute()
    )
    const taskOutcomesPromise = Promise.allSettled(taskPromises)
    expect(longRunningPool.workerNodes.length).toBe(max)
    expect(await exitEvents.promise).toBe(max - min)
    expect(longRunningPool.workerNodes.length).toBe(min)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
    const taskOutcomes = await taskOutcomesPromise
    expect(taskOutcomes).toHaveLength(max * 2)
    expect(
      taskOutcomes.every(
        outcome =>
          outcome.status === 'rejected' &&
          outcome.reason instanceof WorkerTerminationError
      )
    ).toBe(true)
  })

  it('Verify scale thread up and down is working when long executing task is used:soft', async () => {
    const longRunningPool = new DynamicThreadPool(
      min,
      max,
      './tests/worker-files/thread/longRunningWorkerSoftBehavior.mjs',
      {
        errorHandler: e => console.error(e),
        exitHandler: () => console.info('long executing worker exited'),
        onlineHandler: () => console.info('long executing worker is online'),
      }
    )
    expect(longRunningPool.workerNodes.length).toBe(min)
    const taskPromises = Array.from({ length: max * 2 }, () =>
      longRunningPool.execute()
    )
    const taskOutcomesPromise = Promise.allSettled(taskPromises)
    expect(longRunningPool.workerNodes.length).toBe(max)
    await sleep(1000)
    // Here we expect the workerNodes to be at the max size since the task is still executing
    expect(longRunningPool.workerNodes.length).toBe(max)
    // We need to clean up the resources after our test
    await longRunningPool.destroy()
    const taskOutcomes = await taskOutcomesPromise
    expect(taskOutcomes).toHaveLength(max * 2)
    expect(
      taskOutcomes.every(
        outcome =>
          outcome.status === 'rejected' &&
          outcome.reason instanceof WorkerTerminationError
      )
    ).toBe(true)
  })

  it('Verify that a pool with zero worker can be instantiated', async () => {
    const pool = new DynamicThreadPool(
      0,
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
    expect(pool).toBeInstanceOf(DynamicThreadPool)
    // We need to clean up the resources after our test
    await pool.destroy()
  })

  it('Verify that a pool with zero worker works', async () => {
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      const pool = new DynamicThreadPool(
        0,
        max,
        './tests/worker-files/thread/testWorker.mjs',
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
