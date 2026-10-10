import {
  describe,
  DynamicClusterPool,
  expect,
  it,
  numberOfWorkers,
  PoolEvents,
  PoolTypes,
  version,
  waitPoolEvents,
  WorkerChoiceStrategies,
  WorkerTypes,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it("Verify that pool event emitter 'empty' event can register a callback", async () => {
    const pool = new DynamicClusterPool(
      0,
      numberOfWorkers,
      './tests/worker-files/cluster/testWorker.cjs'
    )
    expect(pool.emitter.eventNames()).toStrictEqual([])
    const promises = new Set()
    let poolEmpty = 0
    let poolInfo
    pool.emitter.on(PoolEvents.empty, info => {
      ++poolEmpty
      poolInfo = info
    })
    expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.empty])
    for (let i = 0; i < numberOfWorkers; i++) {
      promises.add(pool.execute())
    }
    await Promise.all(promises)
    await waitPoolEvents(pool, PoolEvents.empty, 1)
    expect(poolEmpty).toBe(1)
    expect(poolInfo).toStrictEqual({
      busyWorkerNodes: 0,
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
      dynamicWorkerNodes: 0,
      executedTasks: expect.any(Number),
      executingTasks: expect.any(Number),
      failedTasks: expect.any(Number),
      idleWorkerNodes: 0,
      maxSize: numberOfWorkers,
      minSize: 0,
      ready: true,
      started: true,
      strategyRetries: expect.any(Number),
      type: PoolTypes.dynamic,
      version,
      worker: WorkerTypes.cluster,
      workerNodes: 0,
    })
    await pool.destroy()
  })
})
