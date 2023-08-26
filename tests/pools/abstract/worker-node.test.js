const { MessageChannel, Worker } = require('worker_threads')
const { expect } = require('expect')
const { WorkerNode } = require('../../../lib/pools/worker-node')
const { WorkerTypes } = require('../../../lib')
const { CircularArray } = require('../../../lib/circular-array')
const { Deque } = require('../../../lib/deque')
const { DEFAULT_TASK_NAME } = require('../../../lib/utils')

describe('Worker node test suite', () => {
  const worker = new Worker('./tests/worker-files/thread/testWorker.js')
  const workerNode = new WorkerNode(worker, WorkerTypes.thread, 12)

  it('Worker node instantiation', () => {
    expect(() => new WorkerNode()).toThrowError(
      new TypeError('Cannot construct a worker node without a worker')
    )
    expect(() => new WorkerNode(worker)).toThrowError(
      new TypeError('Cannot construct a worker node without a worker type')
    )
    expect(() => new WorkerNode(worker, WorkerTypes.thread)).toThrowError(
      new TypeError(
        'Cannot construct a worker node without a tasks queue back pressure size'
      )
    )
    expect(
      () =>
        new WorkerNode(
          worker,
          WorkerTypes.thread,
          'invalidTasksQueueBackPressureSize'
        )
    ).toThrowError(
      new TypeError(
        'Cannot construct a worker node with a tasks queue back pressure size that is not an integer'
      )
    )
    expect(workerNode).toBeInstanceOf(WorkerNode)
    expect(workerNode.worker).toBe(worker)
    expect(workerNode.info).toStrictEqual({
      id: worker.threadId,
      type: WorkerTypes.thread,
      dynamic: false,
      ready: false
    })
    expect(workerNode.usage).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        maxQueued: 0,
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: expect.any(CircularArray)
      },
      waitTime: {
        history: expect.any(CircularArray)
      },
      elu: {
        idle: {
          history: expect.any(CircularArray)
        },
        active: {
          history: expect.any(CircularArray)
        }
      }
    })
    expect(workerNode.messageChannel).toBeInstanceOf(MessageChannel)
    expect(workerNode.tasksQueueBackPressureSize).toBe(12)
    expect(workerNode.tasksQueue).toBeInstanceOf(Deque)
    expect(workerNode.tasksQueue.size).toBe(0)
    expect(workerNode.taskFunctionsUsage).toBeInstanceOf(Map)
  })

  it('Worker node getTaskFunctionWorkerUsage()', () => {
    expect(() =>
      workerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toThrowError(
      new TypeError(
        "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function names list is not yet defined"
      )
    )
    workerNode.info.taskFunctions = [DEFAULT_TASK_NAME, 'fn1']
    expect(() =>
      workerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
    ).toThrowError(
      new TypeError(
        "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function names list has less than 3 elements"
      )
    )
    workerNode.info.taskFunctions = [DEFAULT_TASK_NAME, 'fn1', 'fn2']
    expect(
      workerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME)
    ).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: expect.any(CircularArray)
      },
      waitTime: {
        history: expect.any(CircularArray)
      },
      elu: {
        idle: {
          history: expect.any(CircularArray)
        },
        active: {
          history: expect.any(CircularArray)
        }
      }
    })
    expect(workerNode.getTaskFunctionWorkerUsage('fn1')).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: expect.any(CircularArray)
      },
      waitTime: {
        history: expect.any(CircularArray)
      },
      elu: {
        idle: {
          history: expect.any(CircularArray)
        },
        active: {
          history: expect.any(CircularArray)
        }
      }
    })
    expect(workerNode.getTaskFunctionWorkerUsage('fn2')).toStrictEqual({
      tasks: {
        executed: 0,
        executing: 0,
        queued: 0,
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: expect.any(CircularArray)
      },
      waitTime: {
        history: expect.any(CircularArray)
      },
      elu: {
        idle: {
          history: expect.any(CircularArray)
        },
        active: {
          history: expect.any(CircularArray)
        }
      }
    })
    expect(workerNode.taskFunctionsUsage.size).toBe(2)
  })
})
