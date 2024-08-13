import { Worker as ClusterWorker } from 'node:cluster'
import { MessageChannel, Worker as ThreadWorker } from 'node:worker_threads'

import { expect } from 'expect'

import { CircularBuffer } from '../../lib/circular-buffer.cjs'
import { WorkerTypes } from '../../lib/index.cjs'
import { MeasurementHistorySize } from '../../lib/pools/worker.cjs'
import { WorkerNode } from '../../lib/pools/worker-node.cjs'
import { PriorityQueue } from '../../lib/queues/priority-queue.cjs'
import { DEFAULT_TASK_NAME } from '../../lib/utils.cjs'

describe('Worker node test suite', () => {
  let threadWorkerNode, clusterWorkerNode

  before('Create worker nodes', () => {
    threadWorkerNode = new WorkerNode(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      }
    )
    clusterWorkerNode = new WorkerNode(
      WorkerTypes.cluster,
      './tests/worker-files/cluster/testWorker.cjs',
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      }
    )
  })

  after('Terminate worker nodes', async () => {
    await threadWorkerNode.terminate()
    await clusterWorkerNode.terminate()
  })

  it('Worker node instantiation', () => {
    expect(() => new WorkerNode()).toThrow(
      new TypeError('Cannot construct a worker node without a worker type')
    )
    expect(
      () =>
        new WorkerNode(
          'invalidWorkerType',
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new TypeError(
        "Cannot construct a worker node with an invalid worker type 'invalidWorkerType'"
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs'
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node without worker node options'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          ''
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with invalid worker node options: must be a plain object'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {}
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node without a tasks queue back pressure size option'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 'invalidTasksQueueBackPressureSize' }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with a tasks queue back pressure size option that is not an integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 0.2 }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with a tasks queue back pressure size option that is not an integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 0 }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node with a tasks queue back pressure size option that is not a positive integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: -1 }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node with a tasks queue back pressure size option that is not a positive integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {
            tasksQueueBackPressureSize: 12,
          }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node without a tasks queue bucket size option'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {
            tasksQueueBackPressureSize: 12,
            tasksQueueBucketSize: 'invalidTasksQueueBucketSize',
          }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with a tasks queue bucket size option that is not an integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 12, tasksQueueBucketSize: 0.2 }
        )
    ).toThrow(
      new TypeError(
        'Cannot construct a worker node with a tasks queue bucket size option that is not an integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 12, tasksQueueBucketSize: 0 }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node with a tasks queue bucket size option that is not a positive integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 12, tasksQueueBucketSize: -1 }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node with a tasks queue bucket size option that is not a positive integer'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {
            tasksQueueBackPressureSize: 12,
            tasksQueueBucketSize: 6,
          }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node without a tasks queue priority option'
      )
    )
    expect(
      () =>
        new WorkerNode(
          WorkerTypes.thread,
          './tests/worker-files/thread/testWorker.mjs',
          {
            tasksQueueBackPressureSize: 12,
            tasksQueueBucketSize: 6,
            tasksQueuePriority: 'invalidTasksQueuePriority',
          }
        )
    ).toThrow(
      new RangeError(
        'Cannot construct a worker node with a tasks queue priority option that is not a boolean'
      )
    )
    expect(threadWorkerNode).toBeInstanceOf(WorkerNode)
    expect(threadWorkerNode.worker).toBeInstanceOf(ThreadWorker)
    expect(threadWorkerNode.info).toStrictEqual({
      id: threadWorkerNode.worker.threadId,
      type: WorkerTypes.thread,
      dynamic: false,
      ready: false,
      stealing: false,
      stolen: false,
      backPressure: false,
    })
    expect(threadWorkerNode.usage).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        maxQueued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: expect.any(CircularBuffer),
      },
      waitTime: {
        history: expect.any(CircularBuffer),
      },
      elu: {
        idle: {
          history: expect.any(CircularBuffer),
        },
        active: {
          history: expect.any(CircularBuffer),
        },
      },
    })
    expect(threadWorkerNode.usage.runTime.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(threadWorkerNode.usage.waitTime.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(threadWorkerNode.usage.elu.idle.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(threadWorkerNode.usage.elu.active.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(threadWorkerNode.messageChannel).toBeInstanceOf(MessageChannel)
    expect(threadWorkerNode.tasksQueueBackPressureSize).toBe(12)
    expect(threadWorkerNode.tasksQueue).toBeInstanceOf(PriorityQueue)
    expect(threadWorkerNode.tasksQueue.size).toBe(0)
    expect(threadWorkerNode.tasksQueue.bucketSize).toBe(6)
    expect(threadWorkerNode.tasksQueue.enablePriority).toBe(true)
    expect(threadWorkerNode.tasksQueueSize()).toBe(
      threadWorkerNode.tasksQueue.size
    )
    expect(threadWorkerNode.setBackPressureFlag).toBe(false)
    expect(threadWorkerNode.taskFunctionsUsage).toBeInstanceOf(Map)

    expect(clusterWorkerNode).toBeInstanceOf(WorkerNode)
    expect(clusterWorkerNode.worker).toBeInstanceOf(ClusterWorker)
    expect(clusterWorkerNode.info).toStrictEqual({
      id: clusterWorkerNode.worker.id,
      type: WorkerTypes.cluster,
      dynamic: false,
      ready: false,
      stealing: false,
      stolen: false,
      backPressure: false,
    })
    expect(clusterWorkerNode.usage).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        maxQueued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: expect.any(CircularBuffer),
      },
      waitTime: {
        history: expect.any(CircularBuffer),
      },
      elu: {
        idle: {
          history: expect.any(CircularBuffer),
        },
        active: {
          history: expect.any(CircularBuffer),
        },
      },
    })
    expect(clusterWorkerNode.usage.runTime.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(clusterWorkerNode.usage.waitTime.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(clusterWorkerNode.usage.elu.idle.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(clusterWorkerNode.usage.elu.active.history.items.length).toBe(
      MeasurementHistorySize
    )
    expect(clusterWorkerNode.messageChannel).toBeUndefined()
    expect(clusterWorkerNode.tasksQueueBackPressureSize).toBe(12)
    expect(clusterWorkerNode.tasksQueue).toBeInstanceOf(PriorityQueue)
    expect(clusterWorkerNode.tasksQueue.size).toBe(0)
    expect(clusterWorkerNode.tasksQueue.bucketSize).toBe(6)
    expect(clusterWorkerNode.tasksQueue.enablePriority).toBe(true)
    expect(clusterWorkerNode.tasksQueueSize()).toBe(
      clusterWorkerNode.tasksQueue.size
    )
    expect(clusterWorkerNode.setBackPressureFlag).toBe(false)
    expect(clusterWorkerNode.taskFunctionsUsage).toBeInstanceOf(Map)
  })

  it('Worker node getTaskFunctionWorkerUsage()', () => {
    expect(() =>
      threadWorkerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toThrow(
      new TypeError(
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
      new TypeError(
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
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: expect.any(CircularBuffer),
      },
      waitTime: {
        history: expect.any(CircularBuffer),
      },
      elu: {
        idle: {
          history: expect.any(CircularBuffer),
        },
        active: {
          history: expect.any(CircularBuffer),
        },
      },
    })
    expect(threadWorkerNode.getTaskFunctionWorkerUsage('fn1')).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: expect.any(CircularBuffer),
      },
      waitTime: {
        history: expect.any(CircularBuffer),
      },
      elu: {
        idle: {
          history: expect.any(CircularBuffer),
        },
        active: {
          history: expect.any(CircularBuffer),
        },
      },
    })
    expect(threadWorkerNode.getTaskFunctionWorkerUsage('fn2')).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: expect.any(CircularBuffer),
      },
      waitTime: {
        history: expect.any(CircularBuffer),
      },
      elu: {
        idle: {
          history: expect.any(CircularBuffer),
        },
        active: {
          history: expect.any(CircularBuffer),
        },
      },
    })
    expect(threadWorkerNode.taskFunctionsUsage.size).toBe(2)
  })

  it('Worker node deleteTaskFunctionWorkerUsage()', () => {
    expect(threadWorkerNode.info.taskFunctionsProperties).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'fn1' },
      { name: 'fn2' },
    ])
    expect(threadWorkerNode.taskFunctionsUsage.size).toBe(2)
    expect(
      threadWorkerNode.deleteTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toBe(false)
    expect(threadWorkerNode.taskFunctionsUsage.size).toBe(2)
    expect(threadWorkerNode.deleteTaskFunctionWorkerUsage('fn1')).toBe(true)
    expect(threadWorkerNode.taskFunctionsUsage.size).toBe(1)
  })
})
