import {
  describe,
  DynamicThreadPool,
  expect,
  it,
  numberOfWorkers,
  PoolEvents,
  waitPoolEvents,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that addTaskFunction() with workerNodeKeys is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    const poolWorkerNodeKeys = [...dynamicThreadPool.workerNodes.keys()]

    // Test with valid workerNodeKeys
    const echoTaskFunction = data => {
      return data
    }
    await expect(
      dynamicThreadPool.addTaskFunction('affinityEcho', {
        taskFunction: echoTaskFunction,
        workerNodeKeys: [poolWorkerNodeKeys[0]],
      })
    ).resolves.toBe(true)
    expect(
      dynamicThreadPool.taskFunctionStore.get('affinityEcho')
    ).toStrictEqual({
      taskFunction: echoTaskFunction,
      workerNodeKeys: [poolWorkerNodeKeys[0]],
    })

    // Test with invalid workerNodeKeys (out of range)
    await expect(
      dynamicThreadPool.addTaskFunction('invalidKeys', {
        taskFunction: () => {},
        workerNodeKeys: [999],
      })
    ).rejects.toThrow(
      new RangeError(
        'Cannot add a task function with invalid worker node keys: 999. Valid keys are: 0..1'
      )
    )

    // Test with empty array workerNodeKeys
    await expect(
      dynamicThreadPool.addTaskFunction('emptyKeys', {
        taskFunction: () => {},
        workerNodeKeys: [],
      })
    ).rejects.toThrow(
      new RangeError('Invalid worker node keys: must not be an empty array')
    )

    // Test exceeding max workers
    const tooManyKeys = Array.from({ length: numberOfWorkers + 1 }, (_, i) => i)
    await expect(
      dynamicThreadPool.addTaskFunction('tooManyKeys', {
        taskFunction: () => {},
        workerNodeKeys: tooManyKeys,
      })
    ).rejects.toThrow(
      new RangeError(
        'Cannot add a task function with more worker node keys than the maximum number of workers in the pool'
      )
    )

    // Test with duplicate workerNodeKeys
    await expect(
      dynamicThreadPool.addTaskFunction('duplicateKeys', {
        taskFunction: () => {},
        workerNodeKeys: [poolWorkerNodeKeys[0], poolWorkerNodeKeys[0]],
      })
    ).rejects.toThrow(
      new TypeError('Invalid worker node keys: must not contain duplicates')
    )

    // Test with non-integer values
    await expect(
      dynamicThreadPool.addTaskFunction('nonIntegerKeys', {
        taskFunction: () => {},
        workerNodeKeys: [1.5],
      })
    ).rejects.toThrow(
      new TypeError(
        "Invalid worker node key '1.5': must be a non-negative safe integer"
      )
    )

    // Test with negative values
    await expect(
      dynamicThreadPool.addTaskFunction('negativeKeys', {
        taskFunction: () => {},
        workerNodeKeys: [-1],
      })
    ).rejects.toThrow(
      new TypeError(
        "Invalid worker node key '-1': must be a non-negative safe integer"
      )
    )

    await dynamicThreadPool.destroy()
  })

  it('Verify that execute() respects workerNodeKeys affinity', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    const poolWorkerNodeKeys = [...dynamicThreadPool.workerNodes.keys()]

    // Add task function with affinity to first worker only
    const affinityTaskFunction = data => {
      return data
    }
    await dynamicThreadPool.addTaskFunction('affinityTask', {
      taskFunction: affinityTaskFunction,
      workerNodeKeys: [poolWorkerNodeKeys[0]],
    })

    // Reset task counts to track new executions
    for (const workerNode of dynamicThreadPool.workerNodes) {
      workerNode.usage.tasks.executed = 0
    }

    // Execute multiple tasks with affinity
    const numTasks = 5
    const tasks = []
    for (let i = 0; i < numTasks; i++) {
      tasks.push(dynamicThreadPool.execute({ test: i }, 'affinityTask'))
    }
    await Promise.all(tasks)

    // Verify that only the affinity worker received the tasks
    const affinityWorkerNode =
      dynamicThreadPool.workerNodes[poolWorkerNodeKeys[0]]
    expect(affinityWorkerNode.usage.tasks.executed).toBe(numTasks)

    // Other workers should have 0 tasks from affinityTask
    for (let i = 0; i < dynamicThreadPool.workerNodes.length; i++) {
      if (i !== poolWorkerNodeKeys[0]) {
        expect(dynamicThreadPool.workerNodes[i].usage.tasks.executed).toBe(0)
      }
    }

    await dynamicThreadPool.destroy()
  })

  it('Verify that execute() creates dynamic workers for workerNodeKeys affinity', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      1,
      4,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    expect(dynamicThreadPool.workerNodes.length).toBe(1)

    await dynamicThreadPool.addTaskFunction('affinityBeyondMin', {
      taskFunction: data => data,
      workerNodeKeys: [2, 3],
    })

    for (const workerNode of dynamicThreadPool.workerNodes) {
      workerNode.usage.tasks.executed = 0
    }

    const tasks = []
    for (let i = 0; i < 4; i++) {
      tasks.push(dynamicThreadPool.execute({ test: i }, 'affinityBeyondMin'))
    }
    await Promise.all(tasks)

    expect(dynamicThreadPool.workerNodes.length).toBeGreaterThanOrEqual(4)
    const executedOnAffinity =
      dynamicThreadPool.workerNodes[2].usage.tasks.executed +
      dynamicThreadPool.workerNodes[3].usage.tasks.executed
    expect(executedOnAffinity).toBe(4)

    await dynamicThreadPool.destroy()
  })
})
