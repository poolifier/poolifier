import {
  DEFAULT_TASK_NAME,
  describe,
  DynamicThreadPool,
  expect,
  FixedClusterPool,
  it,
  numberOfWorkers,
  PoolEvents,
  waitPoolEvents,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that hasTaskFunction() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    expect(dynamicThreadPool.hasTaskFunction(DEFAULT_TASK_NAME)).toBe(true)
    expect(dynamicThreadPool.hasTaskFunction('jsonIntegerSerialization')).toBe(
      true
    )
    expect(dynamicThreadPool.hasTaskFunction('factorial')).toBe(true)
    expect(dynamicThreadPool.hasTaskFunction('fibonacci')).toBe(true)
    expect(dynamicThreadPool.hasTaskFunction('unknown')).toBe(false)
    await dynamicThreadPool.destroy()
    const fixedClusterPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testMultipleTaskFunctionsWorker.cjs'
    )
    await waitPoolEvents(fixedClusterPool, PoolEvents.ready, 1)
    expect(fixedClusterPool.hasTaskFunction(DEFAULT_TASK_NAME)).toBe(true)
    expect(fixedClusterPool.hasTaskFunction('jsonIntegerSerialization')).toBe(
      true
    )
    expect(fixedClusterPool.hasTaskFunction('factorial')).toBe(true)
    expect(fixedClusterPool.hasTaskFunction('fibonacci')).toBe(true)
    expect(fixedClusterPool.hasTaskFunction('unknown')).toBe(false)
    await fixedClusterPool.destroy()
  })
})
