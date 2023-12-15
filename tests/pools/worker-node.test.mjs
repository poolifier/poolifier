import { MessageChannel } from 'node:worker_threads'
import { expect } from 'expect'
import { WorkerNode } from '../../lib/pools/worker-node.js'
import { WorkerTypes } from '../../lib/index.js'
import { CircularArray } from '../../lib/circular-array.js'
import { Deque } from '../../lib/deque.js'
import { DEFAULT_TASK_NAME } from '../../lib/utils.js'

describe('Worker node test suite', () => {
  const threadWorkerNode = new WorkerNode(
    WorkerTypes.thread,
    './tests/worker-files/thread/testWorker.mjs',
    { tasksQueueBackPressureSize: 12 }
  )
  const clusterWorkerNode = new WorkerNode(
    WorkerTypes.cluster,
    './tests/worker-files/cluster/testWorker.js',
    { tasksQueueBackPressureSize: 12 }
  )

  it('Worker node instantiation', () => {
    expect(() => new WorkerNode()).toThrow(
      new TypeError('Cannot construct a worker node without a worker type')
    )
    expect(
      () =>
        new WorkerNode(
          'invalidWorkerType',
          './tests/worker-files/thread/testWorker.mjs',
          { tasksQueueBackPressureSize: 12 }
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
        'Cannot construct a worker node with invalid options: must be a plain object'
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
    expect(threadWorkerNode).toBeInstanceOf(WorkerNode)
    expect(threadWorkerNode.info).toStrictEqual({
      id: threadWorkerNode.worker.threadId,
      type: WorkerTypes.thread,
      dynamic: false,
      ready: false
    })
    expect(threadWorkerNode.usage).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        maxQueued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: new CircularArray()
      },
      waitTime: {
        history: new CircularArray()
      },
      elu: {
        idle: {
          history: new CircularArray()
        },
        active: {
          history: new CircularArray()
        }
      }
    })
    expect(threadWorkerNode.messageChannel).toBeInstanceOf(MessageChannel)
    expect(threadWorkerNode.tasksQueueBackPressureSize).toBe(12)
    expect(threadWorkerNode.tasksQueue).toBeInstanceOf(Deque)
    expect(threadWorkerNode.tasksQueue.size).toBe(0)
    expect(threadWorkerNode.tasksQueueSize()).toBe(
      threadWorkerNode.tasksQueue.size
    )
    expect(threadWorkerNode.onBackPressureStarted).toBe(false)
    expect(threadWorkerNode.taskFunctionsUsage).toBeInstanceOf(Map)

    expect(clusterWorkerNode).toBeInstanceOf(WorkerNode)
    expect(clusterWorkerNode.info).toStrictEqual({
      id: clusterWorkerNode.worker.id,
      type: WorkerTypes.cluster,
      dynamic: false,
      ready: false
    })
    expect(clusterWorkerNode.usage).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        maxQueued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: new CircularArray()
      },
      waitTime: {
        history: new CircularArray()
      },
      elu: {
        idle: {
          history: new CircularArray()
        },
        active: {
          history: new CircularArray()
        }
      }
    })
    expect(clusterWorkerNode.messageChannel).toBeUndefined()
    expect(clusterWorkerNode.tasksQueueBackPressureSize).toBe(12)
    expect(clusterWorkerNode.tasksQueue).toBeInstanceOf(Deque)
    expect(clusterWorkerNode.tasksQueue.size).toBe(0)
    expect(clusterWorkerNode.tasksQueueSize()).toBe(
      clusterWorkerNode.tasksQueue.size
    )
    expect(clusterWorkerNode.onBackPressureStarted).toBe(false)
    expect(clusterWorkerNode.taskFunctionsUsage).toBeInstanceOf(Map)
  })

  it('Worker node getTaskFunctionWorkerUsage()', () => {
    expect(() =>
      threadWorkerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toThrow(
      new TypeError(
        "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function names list is not yet defined"
      )
    )
    threadWorkerNode.info.taskFunctionNames = [DEFAULT_TASK_NAME, 'fn1']
    expect(() =>
      threadWorkerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toThrow(
      new TypeError(
        "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function names list has less than 3 elements"
      )
    )
    threadWorkerNode.info.taskFunctionNames = [DEFAULT_TASK_NAME, 'fn1', 'fn2']
    expect(
      threadWorkerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME)
    ).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: new CircularArray()
      },
      waitTime: {
        history: new CircularArray()
      },
      elu: {
        idle: {
          history: new CircularArray()
        },
        active: {
          history: new CircularArray()
        }
      }
    })
    expect(threadWorkerNode.getTaskFunctionWorkerUsage('fn1')).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: new CircularArray()
      },
      waitTime: {
        history: new CircularArray()
      },
      elu: {
        idle: {
          history: new CircularArray()
        },
        active: {
          history: new CircularArray()
        }
      }
    })
    expect(threadWorkerNode.getTaskFunctionWorkerUsage('fn2')).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: new CircularArray()
      },
      waitTime: {
        history: new CircularArray()
      },
      elu: {
        idle: {
          history: new CircularArray()
        },
        active: {
          history: new CircularArray()
        }
      }
    })
    expect(threadWorkerNode.taskFunctionsUsage.size).toBe(2)
  })

  it('Worker node deleteTaskFunctionWorkerUsage()', () => {
    expect(threadWorkerNode.info.taskFunctionNames).toStrictEqual([
      DEFAULT_TASK_NAME,
      'fn1',
      'fn2'
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
