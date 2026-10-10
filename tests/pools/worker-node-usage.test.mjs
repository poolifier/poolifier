import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CircularBuffer } from '../../lib/circular-buffer.mjs'
import { WorkerTypes } from '../../lib/index.mjs'
import { WorkerNode } from '../../lib/pools/worker-node.mjs'
import { DEFAULT_TASK_NAME } from '../../lib/utils.mjs'

describe('Worker node task-function usage', () => {
  let threadWorkerNode

  beforeAll(() => {
    threadWorkerNode = new WorkerNode(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      }
    )
  })

  afterAll(async () => {
    if (process.env.CI != null) return
    await threadWorkerNode.terminate()
  })

  it('Worker node getTaskFunctionWorkerUsage()', () => {
    expect(() =>
      threadWorkerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toThrow(
      new Error(
        "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function properties list is not yet defined"
      )
    )
    threadWorkerNode.info.taskFunctionsProperties = [
      { name: DEFAULT_TASK_NAME },
      { name: 'fn1' },
    ]
    expect(() =>
      threadWorkerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toThrow(
      new Error(
        "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function properties list has less than 3 elements"
      )
    )
    threadWorkerNode.info.taskFunctionsProperties = [
      { name: DEFAULT_TASK_NAME },
      { name: 'fn1' },
      { name: 'fn2' },
    ]
    expect(
      threadWorkerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME)
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
        executed: 0,
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
    expect(threadWorkerNode.getTaskFunctionWorkerUsage('fn1')).toStrictEqual({
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
        executed: 0,
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
    expect(threadWorkerNode.getTaskFunctionWorkerUsage('fn2')).toStrictEqual({
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
        executed: 0,
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
  })

  it('Worker node deleteTaskFunctionWorkerUsage()', () => {
    expect(threadWorkerNode.info.taskFunctionsProperties).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'fn1' },
      { name: 'fn2' },
    ])
    expect(
      threadWorkerNode.deleteTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toBe(false)
    expect(threadWorkerNode.deleteTaskFunctionWorkerUsage('fn1')).toBe(true)
  })
})
