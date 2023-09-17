const { MessageChannel, Worker } = require('node:worker_threads')
const cluster = require('node:cluster')
const { expect } = require('expect')
const { WorkerNode } = require('../../../lib/pools/worker-node')
const { WorkerTypes } = require('../../../lib')
const { CircularArray } = require('../../../lib/circular-array')
const { Deque } = require('../../../lib/deque')
const { DEFAULT_TASK_NAME } = require('../../../lib/utils')

describe('Worker node test suite', () => {
  const threadWorker = new Worker('./tests/worker-files/thread/testWorker.js')
  const clusterWorker = cluster.fork()
  const threadWorkerNode = new WorkerNode(threadWorker, 12)
  const clusterWorkerNode = new WorkerNode(clusterWorker, 12)

  it('Worker node instantiation', () => {
    expect(() => new WorkerNode()).toThrowError(
      new TypeError('Cannot construct a worker node without a worker')
    )
    expect(() => new WorkerNode(threadWorker)).toThrowError(
      new TypeError(
        'Cannot construct a worker node without a tasks queue back pressure size'
      )
    )
    expect(
      () => new WorkerNode(threadWorker, 'invalidTasksQueueBackPressureSize')
    ).toThrowError(
      new TypeError(
        'Cannot construct a worker node with a tasks queue back pressure size that is not an integer'
      )
    )
    expect(() => new WorkerNode(threadWorker, 0.2)).toThrowError(
      new TypeError(
        'Cannot construct a worker node with a tasks queue back pressure size that is not an integer'
      )
    )
    expect(() => new WorkerNode(threadWorker, 0)).toThrowError(
      new RangeError(
        'Cannot construct a worker node with a tasks queue back pressure size that is not a positive integer'
      )
    )
    expect(() => new WorkerNode(threadWorker, -1)).toThrowError(
      new RangeError(
        'Cannot construct a worker node with a tasks queue back pressure size that is not a positive integer'
      )
    )
    expect(threadWorkerNode).toBeInstanceOf(WorkerNode)
    expect(threadWorkerNode.worker).toBe(threadWorker)
    expect(threadWorkerNode.info).toStrictEqual({
      id: threadWorker.threadId,
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
    expect(threadWorkerNode.onEmptyQueueCount).toBe(0)
    expect(threadWorkerNode.taskFunctionsUsage).toBeInstanceOf(Map)

    expect(clusterWorkerNode).toBeInstanceOf(WorkerNode)
    expect(clusterWorkerNode.worker).toBe(clusterWorker)
    expect(clusterWorkerNode.info).toStrictEqual({
      id: clusterWorker.id,
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
    expect(clusterWorkerNode.onEmptyQueueCount).toBe(0)
    expect(clusterWorkerNode.taskFunctionsUsage).toBeInstanceOf(Map)
  })

  it('Worker node getTaskFunctionWorkerUsage()', () => {
    expect(() =>
      threadWorkerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toThrowError(
      new TypeError(
        "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function names list is not yet defined"
      )
    )
    threadWorkerNode.info.taskFunctions = [DEFAULT_TASK_NAME, 'fn1']
    expect(() =>
      threadWorkerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toThrowError(
      new TypeError(
        "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function names list has less than 3 elements"
      )
    )
    threadWorkerNode.info.taskFunctions = [DEFAULT_TASK_NAME, 'fn1', 'fn2']
    expect(
      threadWorkerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME)
    ).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
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
})
