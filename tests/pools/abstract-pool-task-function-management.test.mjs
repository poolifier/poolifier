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
  WorkerChoiceStrategies,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('shadows and restores a static task function without changing the default name', async () => {
    const pool = new DynamicThreadPool(
      1,
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await waitPoolEvents(pool, PoolEvents.ready, 1)
    await pool.setDefaultTaskFunction('factorial')

    await pool.addTaskFunction('factorial', data => data.n + 1)
    await expect(pool.execute({ n: 5 })).resolves.toBe(6)
    await expect(pool.execute({ n: 5 }, 'factorial')).resolves.toBe(6)

    await pool.removeTaskFunction('factorial')
    await expect(pool.execute({ n: 5 })).resolves.toBe(120)
    await expect(pool.execute({ n: 5 }, 'factorial')).resolves.toBe(120)
    expect(pool.listTaskFunctionsProperties()[1].name).toBe('factorial')
    await pool.destroy()
  })

  it('shadows and restores a static task function in a cluster worker', async () => {
    const pool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testMultipleTaskFunctionsWorker.cjs'
    )
    await waitPoolEvents(pool, PoolEvents.ready, 1)
    await pool.setDefaultTaskFunction('factorial')

    await pool.addTaskFunction('factorial', data => data.n + 1)
    await expect(pool.execute({ n: 5 })).resolves.toBe(6)

    await pool.removeTaskFunction('factorial')
    await expect(pool.execute({ n: 5 })).resolves.toBe(120)
    expect(pool.listTaskFunctionsProperties()[1].name).toBe('factorial')
    await pool.destroy()
  })

  it('Verify that removeTaskFunction() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
    ])
    await expect(dynamicThreadPool.removeTaskFunction('test')).rejects.toThrow(
      new Error('Cannot remove a task function not handled on the pool side')
    )
    const echoTaskFunction = data => {
      return data
    }
    await dynamicThreadPool.addTaskFunction('echo', {
      strategy: WorkerChoiceStrategies.LEAST_ELU,
      taskFunction: echoTaskFunction,
    })
    expect(dynamicThreadPool.taskFunctionStore.size).toBe(1)
    expect(dynamicThreadPool.taskFunctionStore.get('echo')).toStrictEqual({
      strategy: WorkerChoiceStrategies.LEAST_ELU,
      taskFunction: echoTaskFunction,
    })
    expect([
      ...dynamicThreadPool.workerChoiceStrategiesContext.workerChoiceStrategies.keys(),
    ]).toStrictEqual([
      WorkerChoiceStrategies.LEAST_USED,
      WorkerChoiceStrategies.LEAST_ELU,
    ])
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
      { name: 'echo', strategy: WorkerChoiceStrategies.LEAST_ELU },
    ])
    await expect(dynamicThreadPool.removeTaskFunction('echo')).resolves.toBe(
      true
    )
    expect(dynamicThreadPool.taskFunctionStore.size).toBe(0)
    expect(dynamicThreadPool.taskFunctionStore.get('echo')).toBeUndefined()
    expect([
      ...dynamicThreadPool.workerChoiceStrategiesContext.workerChoiceStrategies.keys(),
    ]).toStrictEqual([WorkerChoiceStrategies.LEAST_USED])
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
    ])
    await dynamicThreadPool.destroy()
  })

  it('Verify that listTaskFunctionsProperties() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME, priority: 1, workerNodeKeys: [0] },
      { name: 'factorial', priority: 1, workerNodeKeys: [0] },
      { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
      { name: 'jsonIntegerSerialization' },
    ])
    await dynamicThreadPool.destroy()
    const fixedClusterPool = new FixedClusterPool(
      numberOfWorkers,
      './tests/worker-files/cluster/testMultipleTaskFunctionsWorker.cjs'
    )
    await waitPoolEvents(fixedClusterPool, PoolEvents.ready, 1)
    expect(fixedClusterPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME, priority: 1, workerNodeKeys: [0] },
      { name: 'factorial', priority: 1, workerNodeKeys: [0] },
      { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
      { name: 'jsonIntegerSerialization' },
    ])
    await fixedClusterPool.destroy()
  })

  it('Verify that setDefaultTaskFunction() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testMultipleTaskFunctionsWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    await expect(dynamicThreadPool.setDefaultTaskFunction(0)).rejects.toThrow(
      new TypeError('name argument must be a string')
    )
    await expect(
      dynamicThreadPool.setDefaultTaskFunction(DEFAULT_TASK_NAME)
    ).rejects.toThrow(
      new Error(
        'Cannot set the default task function reserved name as the default task function'
      )
    )
    await expect(
      dynamicThreadPool.setDefaultTaskFunction('unknown')
    ).rejects.toThrow(
      new Error(
        'Cannot set the default task function to a non-existing task function'
      )
    )
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME, priority: 1, workerNodeKeys: [0] },
      { name: 'factorial', priority: 1, workerNodeKeys: [0] },
      { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
      { name: 'jsonIntegerSerialization' },
    ])
    await expect(
      dynamicThreadPool.setDefaultTaskFunction('factorial')
    ).resolves.toBe(true)
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME, priority: 1, workerNodeKeys: [0] },
      { name: 'factorial', priority: 1, workerNodeKeys: [0] },
      { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
      { name: 'jsonIntegerSerialization' },
    ])
    await expect(
      dynamicThreadPool.setDefaultTaskFunction('fibonacci')
    ).resolves.toBe(true)
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME, priority: 2, workerNodeKeys: [0, 1] },
      { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
      { name: 'factorial', priority: 1, workerNodeKeys: [0] },
      { name: 'jsonIntegerSerialization' },
    ])
    await dynamicThreadPool.destroy()
  })
})
