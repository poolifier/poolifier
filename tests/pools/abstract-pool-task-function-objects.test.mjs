import {
  CircularBuffer,
  DEFAULT_TASK_NAME,
  describe,
  DynamicThreadPool,
  expect,
  it,
  numberOfWorkers,
} from './abstract-pool-test-support.mjs'

describe('Abstract pool test suite', () => {
  it('Verify that task function objects worker is working', async () => {
    const pool = new DynamicThreadPool(
      Math.floor(numberOfWorkers / 2),
      numberOfWorkers,
      './tests/worker-files/thread/testTaskFunctionObjectsWorker.mjs'
    )
    const data = { n: 10 }
    const result0 = await pool.execute(data)
    expect(result0).toStrictEqual(3628800)
    const result1 = await pool.execute(data, 'jsonIntegerSerialization')
    expect(result1).toStrictEqual({ ok: 1 })
    const result2 = await pool.execute(data, 'factorial')
    expect(result2).toBe(3628800)
    const result3 = await pool.execute(data, 'fibonacci')
    expect(result3).toBe(55)
    expect(pool.info.executingTasks).toBe(0)
    expect(pool.info.executedTasks).toBe(4)
    for (const workerNode of pool.workerNodes) {
      if (workerNode.info.taskFunctionsProperties == null) {
        continue
      }
      expect(workerNode.info.taskFunctionsProperties).toStrictEqual([
        { name: DEFAULT_TASK_NAME, workerNodeKeys: [0] },
        { name: 'factorial', workerNodeKeys: [0] },
        { name: 'fibonacci', priority: -5, workerNodeKeys: [0, 1] },
        { name: 'jsonIntegerSerialization' },
      ])
      expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
      expect(workerNode.tasksQueue.enablePriority).toBe(true)
      for (const taskFunctionProperties of pool.listTaskFunctionsProperties()) {
        expect(
          workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name)
        ).toStrictEqual({
          elu: {
            active: {
              history: expect.any(CircularBuffer),
            },
            idle: {
              history: expect.any(CircularBuffer),
            },
          },
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
          waitTime: {
            history: expect.any(CircularBuffer),
          },
        })
        expect(
          workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name)
            .tasks.executed
        ).toBeGreaterThan(0)
      }
      expect(
        workerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME)
      ).toStrictEqual(
        workerNode.getTaskFunctionWorkerUsage(
          workerNode.info.taskFunctionsProperties[1].name
        )
      )
    }
    await pool.destroy()
  })
})
