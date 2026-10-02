import {
  describe,
  DynamicClusterPool,
  expect,
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
  it("Verify that pool event emitter 'full' and 'fullEnd' events can register a callback", async () => {
    const pool = new DynamicClusterPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    await ready(pool)
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolFull = 0
    let poolFullInfo
    pool.emitter.on(PoolEvents.full, info => {
      ++poolFull
      poolFullInfo = info
    })
    let poolFullEnd = 0
    let poolFullEndInfo
    pool.emitter.on(PoolEvents.fullEnd, info => {
      ++poolFullEnd
      poolFullEndInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([
      PoolEvents.full,
      PoolEvents.fullEnd,
    ])
    for (let i = 0; i < numberOfWorkers * 2; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    expect(poolFull).toBe(1)
    expect(poolFullInfo).toStrictEqual({
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
      dynamicWorkerNodes: Math.floor(numberOfWorkers / 2),
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
      maxSize: numberOfWorkers,
      minSize: Math.floor(numberOfWorkers / 2),
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.dynamic,
      version,
      worker: WorkerTypes.cluster,
      workerNodes: numberOfWorkers,
    })
    await waitPoolEvents(pool, PoolEvents.fullEnd, 1)
    expect(poolFullEnd).toBe(1)
    expect(poolFullEndInfo).toStrictEqual({
      busyWorkerNodes: expect.any(Number),
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
      dynamicWorkerNodes: 0,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: expect.any(Number),
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
})
