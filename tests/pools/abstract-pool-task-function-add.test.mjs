import { vi } from 'vitest'

import {
  CircularBuffer,
  DEFAULT_TASK_NAME,
  describe,
  DynamicThreadPool,
  expect,
  it,
  numberOfWorkers,
  PoolEvents,
  waitPoolEvents,
  WorkerChoiceStrategies,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('dispatches a committed task function when a post-commit projection throws', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    const workersBeforeCommit = [...dynamicThreadPool.workerNodes]
    const thrown = { source: 'strategy projection' }
    const errors = []
    dynamicThreadPool.emitter.on(PoolEvents.error, error => {
      errors.push(error)
    })
    vi.spyOn(
      dynamicThreadPool.workerChoiceStrategiesContext,
      'syncWorkerChoiceStrategies'
    ).mockImplementation(() => {
      throw thrown
    })
    const echo = data => data

    await expect(
      dynamicThreadPool.addTaskFunction('committed-echo', echo)
    ).resolves.toBe(true)

    expect(
      dynamicThreadPool.taskFunctionTransactionManager.snapshot.revision
    ).toBe(1)
    expect(errors).toStrictEqual([thrown])
    expect(dynamicThreadPool.workerNodes).toStrictEqual(workersBeforeCommit)
    await expect(
      dynamicThreadPool.execute({ committed: true }, 'committed-echo')
    ).resolves.toStrictEqual({ committed: true })
    await dynamicThreadPool.destroy()
  })

  it('Verify that addTaskFunction() is working', async () => {
    const dynamicThreadPool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testWorker.mjs'
    )
    await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
    await expect(
      dynamicThreadPool.addTaskFunction(0, () => {})
    ).rejects.toThrow(new TypeError('name argument must be a string'))
    await expect(
      dynamicThreadPool.addTaskFunction('', () => {})
    ).rejects.toThrow(
      new TypeError('name argument must not be an empty string')
    )
    await expect(dynamicThreadPool.addTaskFunction('test', 0)).rejects.toThrow(
      new TypeError('taskFunction property must be a function')
    )
    await expect(dynamicThreadPool.addTaskFunction('test', '')).rejects.toThrow(
      new TypeError('taskFunction property must be a function')
    )
    await expect(
      dynamicThreadPool.addTaskFunction('test', { taskFunction: 0 })
    ).rejects.toThrow(new TypeError('taskFunction property must be a function'))
    await expect(
      dynamicThreadPool.addTaskFunction('test', { taskFunction: '' })
    ).rejects.toThrow(new TypeError('taskFunction property must be a function'))
    await expect(
      dynamicThreadPool.addTaskFunction('test', {
        priority: -21,
        taskFunction: () => {},
      })
    ).rejects.toThrow(
      new RangeError("Property 'priority' must be between -20 and 19")
    )
    await expect(
      dynamicThreadPool.addTaskFunction('test', {
        priority: 20,
        taskFunction: () => {},
      })
    ).rejects.toThrow(
      new RangeError("Property 'priority' must be between -20 and 19")
    )
    await expect(
      dynamicThreadPool.addTaskFunction('test', {
        strategy: 'invalidStrategy',
        taskFunction: () => {},
      })
    ).rejects.toThrow(
      new Error("Invalid worker choice strategy 'invalidStrategy'")
    )
    expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'test' },
    ])
    expect([
      ...dynamicThreadPool.workerChoiceStrategiesContext.workerChoiceStrategies.keys(),
    ]).toStrictEqual([WorkerChoiceStrategies.LEAST_USED])
    const echoTaskFunction = data => {
      return data
    }
    await expect(
      dynamicThreadPool.addTaskFunction('echo', {
        strategy: WorkerChoiceStrategies.LEAST_ELU,
        taskFunction: echoTaskFunction,
      })
    ).resolves.toBe(true)
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
    const taskFunctionData = { test: 'test' }
    const echoResult = await dynamicThreadPool.execute(taskFunctionData, 'echo')
    expect(echoResult).toStrictEqual(taskFunctionData)
    for (const workerNode of dynamicThreadPool.workerNodes) {
      expect(workerNode.getTaskFunctionWorkerUsage('echo')).toStrictEqual({
        elu: expect.objectContaining({
          active: expect.objectContaining({
            history: expect.any(CircularBuffer),
          }),
          idle: expect.objectContaining({
            history: expect.any(CircularBuffer),
          }),
        }),
        runTime: {
          history: expect.any(CircularBuffer),
        },
        tasks: {
          executed: expect.any(Number),
          executing: 0,
          failed: 0,
          queued: 0,
          sequentiallyStolen: 0,
          stolen: 0,
        },
        waitTime: expect.objectContaining({
          history: expect.any(CircularBuffer),
        }),
      })
      expect(
        workerNode.getTaskFunctionWorkerUsage('echo').tasks.executed
      ).toBeGreaterThan(0)
      if (
        workerNode.getTaskFunctionWorkerUsage('echo').waitTime.aggregate == null
      ) {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').waitTime.aggregate
        ).toBeUndefined()
      } else {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').waitTime.aggregate
        ).toBeGreaterThan(0)
      }
      if (
        workerNode.getTaskFunctionWorkerUsage('echo').elu.active.aggregate ==
        null
      ) {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.active.aggregate
        ).toBeUndefined()
      } else {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.active.aggregate
        ).toBeGreaterThan(0)
      }
      if (
        workerNode.getTaskFunctionWorkerUsage('echo').elu.idle.aggregate == null
      ) {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.idle.aggregate
        ).toBeUndefined()
      } else {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.idle.aggregate
        ).toBeGreaterThanOrEqual(0)
      }
      if (
        workerNode.getTaskFunctionWorkerUsage('echo').elu.utilization == null
      ) {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.utilization
        ).toBeUndefined()
      } else {
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.utilization
        ).toBeGreaterThanOrEqual(0)
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').elu.utilization
        ).toBeLessThanOrEqual(1)
      }
    }
    await dynamicThreadPool.destroy()
  })
})
