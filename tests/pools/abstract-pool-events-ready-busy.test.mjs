import {
  describe,
  DynamicClusterPool,
  expect,
  FixedThreadPool,
  it,
  numberOfWorkers,
  PoolEvents,
  PoolTypes,
  ready,
  version,
  waitPoolEvents,
  WorkerChoiceStrategies,
  WorkerTypes,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it("Verify that pool event emitter 'ready' event can register a callback", async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    let poolInfo
    let poolReady = 0
    pool.emitter.on(PoolEvents.ready, info => {
      ++poolReady
      poolInfo = info
    })
    await waitPoolEvents(pool, PoolEvents.ready, 1)
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.ready])
    expect(poolReady).toBe(1)
    expect(poolInfo).toStrictEqual({
      busyWorkerNodes: 0,
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
      dynamicWorkerNodes: 0,
      executedTasks: 0,
      executingTasks: 0,
      failedTasks: 0,
      idleWorkerNodes: Math.floor(numberOfWorkers / 2),
      maxSize: numberOfWorkers,
      minSize: Math.floor(numberOfWorkers / 2),
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.dynamic,
      version,
      worker: WorkerTypes.cluster,
      workerNodes: Math.floor(numberOfWorkers / 2),
    })
    await pool.destroy()
  })

  it("Verify that pool event emitter 'busy' and 'busyEnd' events can register a callback", async () => {
    const pool = new FixedThreadPool(
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await ready(pool)
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolBusy = 0
    let poolBusyInfo
    pool.emitter.on(PoolEvents.busy, info => {
      ++poolBusy
      poolBusyInfo = info
    })
    let poolBusyEnd = 0
    let poolBusyEndInfo
    pool.emitter.on(PoolEvents.busyEnd, info => {
      ++poolBusyEnd
      poolBusyEndInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.busy,
      PoolEvents.busyEnd,
    ])
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    expect(poolBusy).toBe(1)
    expect(poolBusyInfo).toStrictEqual({
      busyWorkerNodes: numberOfWorkers,
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: 0,
      maxSize: numberOfWorkers,
      minSize: numberOfWorkers,
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.fixed,
      version,
      worker: WorkerTypes.thread,
      workerNodes: numberOfWorkers,
    })
    expect(poolBusyEnd).toBe(1)
    expect(poolBusyEndInfo).toStrictEqual({
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      maxSize: numberOfWorkers,
      minSize: numberOfWorkers,
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.fixed,
      version,
      worker: WorkerTypes.thread,
      workerNodes: numberOfWorkers,
    })
    expect(poolBusyEndInfo.busyWorkerNodes).toBeLessThan(numberOfWorkers)
    await pool.destroy()
  })
})
