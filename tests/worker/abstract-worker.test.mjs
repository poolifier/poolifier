import { restore, stub } from 'sinon'
import { afterEach, describe, expect, it } from 'vitest'

import {
  ClusterWorker,
  KillBehaviors,
  ThreadWorker,
  WorkerChoiceStrategies,
} from '../../lib/index.mjs'
import { DEFAULT_TASK_NAME, EMPTY_FUNCTION } from '../../lib/utils.mjs'
import { TaskFunctionLayers } from '../../lib/worker/task-function-layers.mjs'
import { sleep } from '../test-utils.cjs'

describe('Abstract worker test suite', () => {
  class StubWorkerWithMainWorker extends ThreadWorker {
    constructor (fn, opts) {
      super(fn, opts)
      delete this.mainWorker
    }
  }

  class MutableTaskFunctionsWorker extends ThreadWorker {
    clearTaskFunctions () {
      this.taskFunctions.clear()
    }

    deleteTaskFunction (name) {
      return this.taskFunctions.delete(name)
    }

    setTaskFunction (name, taskFunction) {
      this.taskFunctions.set(name, { taskFunction })
    }

    staticTaskFunctionsProperties () {
      return this.listStaticTaskFunctionsProperties()
    }
  }

  afterEach(() => {
    restore()
  })

  it('Verify worker options default values', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.opts).toStrictEqual({
      killBehavior: KillBehaviors.SOFT,
      killHandler: EMPTY_FUNCTION,
      maxInactiveTime: 60000,
    })
  })

  it('Verify that worker options are checked at worker creation', () => {
    expect(() => new ClusterWorker(() => {}, '')).toThrow(
      new TypeError('opts worker options parameter is not a plain object')
    )
    expect(() => new ClusterWorker(() => {}, { killBehavior: '' })).toThrow(
      new TypeError("killBehavior option '' is not valid")
    )
    expect(() => new ClusterWorker(() => {}, { killBehavior: 0 })).toThrow(
      new TypeError("killBehavior option '0' is not valid")
    )
    expect(() => new ThreadWorker(() => {}, { maxInactiveTime: '' })).toThrow(
      new TypeError(
        'maxInactiveTime option is not a positive integer greater or equal than 5'
      )
    )
    expect(() => new ThreadWorker(() => {}, { maxInactiveTime: 0.5 })).toThrow(
      new TypeError(
        'maxInactiveTime option is not a positive integer greater or equal than 5'
      )
    )
    expect(() => new ThreadWorker(() => {}, { maxInactiveTime: 0 })).toThrow(
      new TypeError(
        'maxInactiveTime option is not a positive integer greater or equal than 5'
      )
    )
    expect(() => new ThreadWorker(() => {}, { maxInactiveTime: 4 })).toThrow(
      new TypeError(
        'maxInactiveTime option is not a positive integer greater or equal than 5'
      )
    )
    expect(() => new ThreadWorker(() => {}, { killHandler: '' })).toThrow(
      new TypeError('killHandler option is not a function')
    )
    expect(() => new ThreadWorker(() => {}, { killHandler: 0 })).toThrow(
      new TypeError('killHandler option is not a function')
    )
  })

  it('Verify that worker options are set at worker creation', () => {
    const killHandler = () => {
      console.info('Worker received kill message')
    }
    const worker = new ClusterWorker(() => {}, {
      killBehavior: KillBehaviors.HARD,
      killHandler,
      maxInactiveTime: 6000,
    })
    expect(worker.opts).toStrictEqual({
      killBehavior: KillBehaviors.HARD,
      killHandler,
      maxInactiveTime: 6000,
    })
  })

  it('Verify that taskFunctions parameter is mandatory', () => {
    expect(() => new ClusterWorker()).toThrow(
      new Error('taskFunctions parameter is mandatory')
    )
  })

  it('Verify that taskFunctions parameter is a function or a plain object', () => {
    expect(() => new ClusterWorker(0)).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    )
    expect(() => new ClusterWorker('')).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    )
    expect(() => new ClusterWorker(true)).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    )
    expect(() => new ClusterWorker([])).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    )
    expect(() => new ClusterWorker(new Map())).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    )
    expect(() => new ClusterWorker(new Set())).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    )
    expect(() => new ClusterWorker(new WeakMap())).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    )
    expect(() => new ClusterWorker(new WeakSet())).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object'
      )
    )
  })

  it('Verify that taskFunctions parameter is not an empty object', () => {
    expect(() => new ClusterWorker({})).toThrow(
      new Error('taskFunctions parameter object is empty')
    )
  })

  it('Verify that taskFunctions parameter with unique function is taken', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(2)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
  })

  it('Verify that taskFunctions parameter with multiple task functions is checked', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = ''
    expect(() => new ThreadWorker({ '': fn1 })).toThrow(
      new TypeError('name parameter is an empty string')
    )
    expect(() => new ThreadWorker({ fn1, fn2 })).toThrow(
      new TypeError(
        "taskFunction object 'taskFunction' property 'undefined' is not a function"
      )
    )
    expect(() => new ThreadWorker({ fn1: { fn1 } })).toThrow(
      new TypeError(
        "taskFunction object 'taskFunction' property 'undefined' is not a function"
      )
    )
    expect(() => new ThreadWorker({ fn2: { taskFunction: fn2 } })).toThrow(
      new TypeError(
        "taskFunction object 'taskFunction' property '' is not a function"
      )
    )
    expect(
      () => new ThreadWorker({ fn1: { priority: '', taskFunction: fn1 } })
    ).toThrow(new TypeError("Invalid property 'priority': ''"))
    expect(
      () => new ThreadWorker({ fn1: { priority: -21, taskFunction: fn1 } })
    ).toThrow(new RangeError("Property 'priority' must be between -20 and 19"))
    expect(
      () => new ThreadWorker({ fn1: { priority: 20, taskFunction: fn1 } })
    ).toThrow(new RangeError("Property 'priority' must be between -20 and 19"))
    expect(
      () =>
        new ThreadWorker({
          fn1: { strategy: 'invalidStrategy', taskFunction: fn1 },
        })
    ).toThrow(new Error("Invalid worker choice strategy 'invalidStrategy'"))
  })

  it('Verify that taskFunctions parameter with multiple task functions is taken', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ClusterWorker({ fn1, fn2 })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn2')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
  })

  it('Verify that taskFunctions parameter with multiple task functions object is taken', () => {
    const fn1Obj = {
      priority: 5,
      taskFunction: () => {
        return 1
      },
    }
    const fn2Obj = {
      priority: 6,
      strategy: WorkerChoiceStrategies.LESS_BUSY,
      taskFunction: () => {
        return 2
      },
    }
    const worker = new ThreadWorker({
      fn1: fn1Obj,
      fn2: fn2Obj,
    })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(fn1Obj)
    expect(worker.taskFunctions.get('fn1')).toStrictEqual(fn1Obj)
    expect(worker.taskFunctions.get('fn2')).toStrictEqual(fn2Obj)
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
  })

  it('Verify that getMainWorker() throw error if main worker is not set', () => {
    expect(() =>
      new StubWorkerWithMainWorker(() => {}).getMainWorker()
    ).toThrow('Main worker not set')
  })

  it('Verify that hasTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ClusterWorker({ fn1, fn2 })
    expect(worker.hasTaskFunction(0)).toStrictEqual({
      error: new TypeError('name parameter is not a string'),
      status: false,
    })
    expect(worker.hasTaskFunction('')).toStrictEqual({
      error: new TypeError('name parameter is an empty string'),
      status: false,
    })
    expect(worker.hasTaskFunction(DEFAULT_TASK_NAME)).toStrictEqual({
      status: true,
    })
    expect(worker.hasTaskFunction('fn1')).toStrictEqual({ status: true })
    expect(worker.hasTaskFunction('fn2')).toStrictEqual({ status: true })
    expect(worker.hasTaskFunction('fn3')).toStrictEqual({ status: false })
  })

  it('Verify that addTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const fn1Replacement = () => {
      return 3
    }
    const worker = new ThreadWorker(fn1)
    expect(worker.addTaskFunction(0, fn1)).toStrictEqual({
      error: new TypeError('name parameter is not a string'),
      status: false,
    })
    expect(worker.addTaskFunction('', fn1)).toStrictEqual({
      error: new TypeError('name parameter is an empty string'),
      status: false,
    })
    expect(worker.addTaskFunction('fn2', 0)).toStrictEqual({
      error: new TypeError(
        "taskFunction object 'taskFunction' property 'undefined' is not a function"
      ),
      status: false,
    })
    expect(worker.addTaskFunction('fn3', '')).toStrictEqual({
      error: new TypeError(
        "taskFunction object 'taskFunction' property 'undefined' is not a function"
      ),
      status: false,
    })
    expect(worker.addTaskFunction('fn2', { taskFunction: 0 })).toStrictEqual({
      error: new TypeError(
        "taskFunction object 'taskFunction' property '0' is not a function"
      ),
      status: false,
    })
    expect(worker.addTaskFunction('fn3', { taskFunction: '' })).toStrictEqual({
      error: new TypeError(
        "taskFunction object 'taskFunction' property '' is not a function"
      ),
      status: false,
    })
    expect(
      worker.addTaskFunction('fn2', { priority: -21, taskFunction: () => {} })
    ).toStrictEqual({
      error: new RangeError("Property 'priority' must be between -20 and 19"),
      status: false,
    })
    expect(
      worker.addTaskFunction('fn3', { priority: 20, taskFunction: () => {} })
    ).toStrictEqual({
      error: new RangeError("Property 'priority' must be between -20 and 19"),
      status: false,
    })
    expect(
      worker.addTaskFunction('fn2', {
        strategy: 'invalidStrategy',
        taskFunction: () => {},
      })
    ).toStrictEqual({
      error: new Error("Invalid worker choice strategy 'invalidStrategy'"),
      status: false,
    })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(2)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
    expect(worker.addTaskFunction(DEFAULT_TASK_NAME, fn2)).toStrictEqual({
      error: new Error(
        'Cannot add a task function with the default reserved name'
      ),
      status: false,
    })
    worker.addTaskFunction('fn2', fn2)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn2')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
    worker.addTaskFunction('fn1', fn1Replacement)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn2')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
  })

  it('Verify that listTaskFunctionsProperties() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ClusterWorker({ fn1, fn2 })
    expect(worker.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'fn1' },
      { name: 'fn2' },
    ])
  })

  it('Verify that setDefaultTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    expect(worker.setDefaultTaskFunction(0, fn1)).toStrictEqual({
      error: new TypeError('name parameter is not a string'),
      status: false,
    })
    expect(worker.setDefaultTaskFunction('', fn1)).toStrictEqual({
      error: new TypeError('name parameter is an empty string'),
      status: false,
    })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn2')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
    expect(worker.setDefaultTaskFunction(DEFAULT_TASK_NAME)).toStrictEqual({
      error: new Error(
        'Cannot set the default task function reserved name as the default task function'
      ),
      status: false,
    })
    expect(worker.setDefaultTaskFunction('fn3')).toStrictEqual({
      error: new Error(
        'Cannot set the default task function to a non-existing task function'
      ),
      status: false,
    })
    worker.setDefaultTaskFunction('fn1')
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
    worker.setDefaultTaskFunction('fn2')
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn2')
    )
  })

  it('Verify that removeTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    stub(worker, 'sendToMainWorker').returns()
    expect(worker.removeTaskFunction(0)).toStrictEqual({
      error: new TypeError('name parameter is not a string'),
      status: false,
    })
    expect(worker.removeTaskFunction('')).toStrictEqual({
      error: new TypeError('name parameter is an empty string'),
      status: false,
    })
    expect(worker.removeTaskFunction(DEFAULT_TASK_NAME)).toStrictEqual({
      error: new Error(
        'Cannot remove the task function with the default reserved name'
      ),
      status: false,
    })
    expect(worker.removeTaskFunction('fn1')).toStrictEqual({
      error: new Error(
        'Cannot remove the task function used as the default task function'
      ),
      status: false,
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.removeTaskFunction('fn2')).toStrictEqual({ status: true })
    expect(worker.taskFunctions.size).toBe(2)
    expect(worker.taskFunctions.has('fn2')).toBe(false)
  })

  describe('Message handling', () => {
    it('Verify that messageListener() handles statistics message', () => {
      const worker = new ThreadWorker(() => {})
      worker.messageListener({
        statistics: { elu: true, runTime: true },
        workerId: worker.id,
      })
      expect(worker.statistics).toStrictEqual({ elu: true, runTime: true })
    })

    it('Verify that messageListener() handles checkActive message', () => {
      const worker = new ThreadWorker(() => {})
      worker.messageListener({
        checkActive: true,
        workerId: worker.id,
      })
      expect(worker.activeInterval).toBeDefined()
      worker.messageListener({
        checkActive: false,
        workerId: worker.id,
      })
      expect(worker.activeInterval).toBeUndefined()
    })

    it('Verify that messageListener() handles kill message', () => {
      const worker = new ThreadWorker(() => {})
      worker.isMain = false
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.messageListener({
        kill: true,
        workerId: worker.id,
      })
      expect(sendToMainWorkerStub.callCount).toBe(1)
      expect(sendToMainWorkerStub.getCall(0).args[0]).toMatchObject({
        kill: 'success',
      })
    })

    it('Verify that async kill handler is called when worker is killed', async () => {
      const killHandlerStub = stub().returns()
      const worker = new ClusterWorker(() => {}, {
        killHandler: async () => await Promise.resolve(killHandlerStub()),
      })
      worker.isMain = false
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.handleKillMessage()
      await sleep(10)
      expect(killHandlerStub.callCount).toBe(1)
      expect(sendToMainWorkerStub.callCount).toBe(1)
      expect(sendToMainWorkerStub.getCall(0).args[0]).toStrictEqual({
        kill: 'success',
      })
    })

    it('Verify that messageListener() throws on missing workerId', () => {
      const worker = new ThreadWorker(() => {})
      expect(() => worker.messageListener({})).toThrow(
        /Message worker id is not set/
      )
    })

    it('Verify that messageListener() throws on mismatched workerId', () => {
      const worker = new ThreadWorker(() => {})
      expect(() => worker.messageListener({ workerId: 9999 })).toThrow(
        /Message worker id .* does not match/
      )
    })
  })

  describe('Task execution', () => {
    it('keeps sentinel task function layers unique across map projections', () => {
      const sentinelTaskFunction = { taskFunction: () => 'sentinel' }
      const namedTaskFunction = { taskFunction: () => 'named' }
      const replacementTaskFunction = { taskFunction: () => 'replacement' }
      const overlayTaskFunction = { taskFunction: () => 'overlay' }
      const taskFunctionLayers = new TaskFunctionLayers(
        new Map([
          ['named', namedTaskFunction],
          [DEFAULT_TASK_NAME, sentinelTaskFunction],
        ]),
        DEFAULT_TASK_NAME
      )

      expect([...taskFunctionLayers]).toStrictEqual([
        [DEFAULT_TASK_NAME, sentinelTaskFunction],
        ['named', namedTaskFunction],
      ])
      expect([...taskFunctionLayers.entries()]).toStrictEqual([
        [DEFAULT_TASK_NAME, sentinelTaskFunction],
        ['named', namedTaskFunction],
      ])
      expect([...taskFunctionLayers.keys()]).toStrictEqual([
        DEFAULT_TASK_NAME,
        'named',
      ])
      expect([...taskFunctionLayers.values()]).toStrictEqual([
        sentinelTaskFunction,
        namedTaskFunction,
      ])
      expect(taskFunctionLayers.size).toBe(
        [...taskFunctionLayers.keys()].length
      )
      expect(taskFunctionLayers.listEffectiveProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'named' },
      ])
      expect(taskFunctionLayers.listStaticProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'named' },
      ])

      taskFunctionLayers.set(DEFAULT_TASK_NAME, replacementTaskFunction)
      expect(taskFunctionLayers.get(DEFAULT_TASK_NAME)).toBe(
        replacementTaskFunction
      )
      expect([...taskFunctionLayers.keys()]).toStrictEqual([
        DEFAULT_TASK_NAME,
        'named',
      ])

      taskFunctionLayers.addOverlay(DEFAULT_TASK_NAME, overlayTaskFunction)
      expect(taskFunctionLayers.get(DEFAULT_TASK_NAME)).toBe(
        overlayTaskFunction
      )
      expect(taskFunctionLayers.removeOverlay(DEFAULT_TASK_NAME)).toBe(true)
      expect(taskFunctionLayers.get(DEFAULT_TASK_NAME)).toBe(
        replacementTaskFunction
      )

      expect(taskFunctionLayers.setDefault('named')).toBe(true)
      expect(taskFunctionLayers.defaultName).toBe('named')
      expect(taskFunctionLayers.get(DEFAULT_TASK_NAME)).toBe(namedTaskFunction)
      expect([...taskFunctionLayers.keys()]).toStrictEqual([
        DEFAULT_TASK_NAME,
        'named',
      ])
      expect(taskFunctionLayers.size).toBe(
        [...taskFunctionLayers.keys()].length
      )
      expect(taskFunctionLayers.listEffectiveProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'named' },
      ])
      expect(taskFunctionLayers.listStaticProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'named' },
      ])

      expect(taskFunctionLayers.delete(DEFAULT_TASK_NAME)).toBe(true)
      expect([...taskFunctionLayers]).toStrictEqual([])
      expect(taskFunctionLayers.size).toBe(0)

      taskFunctionLayers.clear()
      expect([...taskFunctionLayers]).toStrictEqual([])
      expect(taskFunctionLayers.listEffectiveProperties()).toStrictEqual([])
      expect(taskFunctionLayers.listStaticProperties()).toStrictEqual([])
    })

    it('executes a task function added through the protected live map', () => {
      const worker = new MutableTaskFunctionsWorker({ fn1: () => 1 })
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()

      worker.setTaskFunction('fn2', data => data * 2)
      worker.setDefaultTaskFunction('fn2')
      worker.run({
        data: 21,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(sendToMainWorkerStub.lastCall.args[0].data).toBe(42)
      expect(worker.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'fn2' },
        { name: 'fn1' },
      ])
      expect(worker.staticTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'fn2' },
        { name: 'fn1' },
      ])
    })

    it('Verify that run() executes sync task function', () => {
      const worker = new ThreadWorker(data => data * 2)
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.run({
        data: 21,
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(sendToMainWorkerStub.callCount).toBe(1)
      const lastCall = sendToMainWorkerStub.getCall(0)
      expect(lastCall.args[0].data).toBe(42)
      expect(lastCall.args[0].taskId).toBe(
        '550e8400-e29b-41d4-a716-446655440000'
      )
      expect(lastCall.args[0].taskPerformance).toBeDefined()
    })

    it('Verify that run() executes async task function', async () => {
      const worker = new ThreadWorker(
        async data => await Promise.resolve(data * 2)
      )
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.run({
        data: 21,
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      await sleep(10)
      expect(sendToMainWorkerStub.callCount).toBe(1)
      const lastCall = sendToMainWorkerStub.getCall(0)
      expect(lastCall.args[0].data).toBe(42)
      expect(lastCall.args[0].taskId).toBe(
        '550e8400-e29b-41d4-a716-446655440000'
      )
    })

    it('Verify that run() handles task function not found', () => {
      const worker = new ThreadWorker(() => {})
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.run({
        data: {},
        name: 'unknown',
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(sendToMainWorkerStub.callCount).toBe(1)
      const lastCall = sendToMainWorkerStub.getCall(0)
      expect(lastCall.args[0].workerError).toBeDefined()
      expect(lastCall.args[0].workerError.error.message).toMatch(
        /Task function 'unknown' not found/
      )
    })

    it('Verify that runSync() handles task function error', () => {
      const worker = new ThreadWorker(() => {
        throw new Error('Task error')
      })
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.run({
        data: {},
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(sendToMainWorkerStub.callCount).toBe(1)
      const lastCall = sendToMainWorkerStub.getCall(0)
      expect(lastCall.args[0].workerError).toBeDefined()
      expect(lastCall.args[0].workerError.error.message).toBe('Task error')
    })

    it('Verify that runAsync() handles task function error', async () => {
      const worker = new ThreadWorker(async () => {
        return await Promise.reject(new Error('Async task error'))
      })
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.run({
        data: {},
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      await sleep(10)
      expect(sendToMainWorkerStub.callCount).toBe(1)
      const lastCall = sendToMainWorkerStub.getCall(0)
      expect(lastCall.args[0].workerError).toBeDefined()
      expect(lastCall.args[0].workerError.error.message).toBe(
        'Async task error'
      )
    })

    it('Verify that run() with runTime statistics works', () => {
      const worker = new ThreadWorker(data => data)
      worker.statistics = { elu: false, runTime: true }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.run({
        data: 'test',
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(sendToMainWorkerStub.callCount).toBe(1)
      const lastCall = sendToMainWorkerStub.getCall(0)
      expect(lastCall.args[0].taskPerformance.runTime).toBeGreaterThanOrEqual(0)
    })

    it('Verify that run() with elu statistics works', () => {
      const worker = new ThreadWorker(data => data)
      worker.statistics = { elu: true, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.run({
        data: 'test',
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(sendToMainWorkerStub.callCount).toBe(1)
      const lastCall = sendToMainWorkerStub.getCall(0)
      expect(lastCall.args[0].taskPerformance.elu).toBeDefined()
    })
  })

  describe('Task function operations via messages', () => {
    it('shadows protected map mutations with an overlay and reveals the latest static value', () => {
      const worker = new MutableTaskFunctionsWorker({
        fn1: () => 1,
        fn2: () => 2,
      })
      stub(worker, 'sendToMainWorker').returns()

      worker.handleTaskFunctionOperationMessage({
        taskFunction: '() => 3',
        taskFunctionOperation: 'add',
        taskFunctionProperties: { name: 'fn2' },
      })
      worker.setTaskFunction('fn2', () => 4)
      expect(worker.taskFunctions.get('fn2').taskFunction()).toBe(3)
      expect(worker.staticTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'fn1' },
        { name: 'fn2' },
      ])

      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'remove',
        taskFunctionProperties: { name: 'fn2' },
      })
      expect(worker.taskFunctions.get('fn2').taskFunction()).toBe(4)

      expect(worker.deleteTaskFunction('fn2')).toBe(true)
      expect(worker.taskFunctions.has('fn2')).toBe(false)
      expect(worker.staticTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'fn1' },
      ])
    })

    it('clears static and overlay task functions through the protected map', () => {
      const worker = new MutableTaskFunctionsWorker({ fn1: () => 1 })
      stub(worker, 'sendToMainWorker').returns()
      worker.handleTaskFunctionOperationMessage({
        taskFunction: 'data => data + 1',
        taskFunctionOperation: 'add',
        taskFunctionProperties: { name: 'overlay' },
      })
      worker.setDefaultTaskFunction('overlay')

      worker.clearTaskFunctions()

      expect(worker.taskFunctions.size).toBe(0)
      expect([...worker.taskFunctions]).toStrictEqual([])
      expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeUndefined()
      expect(worker.listTaskFunctionsProperties()).toStrictEqual([])
      expect(worker.staticTaskFunctionsProperties()).toStrictEqual([])
    })

    it('deletes the effective name from static and overlay task functions', () => {
      const worker = new MutableTaskFunctionsWorker({
        fn1: () => 1,
        fn2: () => 2,
      })
      stub(worker, 'sendToMainWorker').returns()
      worker.setDefaultTaskFunction('fn2')
      worker.handleTaskFunctionOperationMessage({
        taskFunction: '() => 3',
        taskFunctionOperation: 'add',
        taskFunctionProperties: { name: 'fn2' },
      })

      expect(worker.deleteTaskFunction(DEFAULT_TASK_NAME)).toBe(true)

      expect(worker.taskFunctions.has(DEFAULT_TASK_NAME)).toBe(false)
      expect(worker.taskFunctions.has('fn2')).toBe(false)
      expect(worker.taskFunctions.size).toBe(1)
      expect([...worker.taskFunctions.keys()]).toStrictEqual(['fn1'])
    })

    it('Verify that handleTaskFunctionOperationMessage() handles add operation', () => {
      const worker = new ThreadWorker(() => {})
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.handleTaskFunctionOperationMessage({
        taskFunction: '(data) => data * 3',
        taskFunctionOperation: 'add',
        taskFunctionProperties: { name: 'newFn' },
      })
      expect(worker.taskFunctions.has('newFn')).toBe(true)
      expect(sendToMainWorkerStub.callCount).toBe(2)
      const lastCall = sendToMainWorkerStub.getCall(1)
      expect(lastCall.args[0].taskFunctionOperationStatus).toBe(true)
    })

    it('echoes the task function operation id when supplied', () => {
      const worker = new ThreadWorker(() => {})
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()

      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'remove',
        taskFunctionOperationId: 'operation-1',
        taskFunctionProperties: { name: 'missing' },
      })

      expect(sendToMainWorkerStub.lastCall.args[0]).toMatchObject({
        taskFunctionOperationId: 'operation-1',
        taskFunctionOperationStatus: false,
      })
    })

    it('keeps legacy task function responses free of an operation id', () => {
      const worker = new ThreadWorker(() => {})
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()

      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'remove',
        taskFunctionProperties: { name: 'missing' },
      })

      expect(sendToMainWorkerStub.lastCall.args[0]).not.toHaveProperty(
        'taskFunctionOperationId'
      )
    })

    it('removes only the runtime overlay and restores the static function', () => {
      const fn1 = () => 1
      const fn2 = () => 2
      const worker = new ThreadWorker({ fn1, fn2 })
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.handleTaskFunctionOperationMessage({
        taskFunction: '() => 3',
        taskFunctionOperation: 'add',
        taskFunctionProperties: { name: 'fn2' },
      })
      expect(worker.taskFunctions.get('fn2').taskFunction()).toBe(3)
      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'remove',
        taskFunctionProperties: { name: 'fn2' },
      })
      expect(worker.taskFunctions.get('fn2').taskFunction()).toBe(2)
      expect(sendToMainWorkerStub.callCount).toBe(4)
      const lastCall = sendToMainWorkerStub.getCall(3)
      expect(lastCall.args[0].taskFunctionOperationStatus).toBe(true)
    })

    it('preserves the logical default while an overlay shadows and restores it', () => {
      const worker = new ThreadWorker({ fn1: () => 1, fn2: () => 2 })
      stub(worker, 'sendToMainWorker').returns()
      worker.setDefaultTaskFunction('fn2')

      worker.handleTaskFunctionOperationMessage({
        taskFunction: '() => 3',
        taskFunctionOperation: 'add',
        taskFunctionProperties: { name: 'fn2' },
      })
      expect(worker.taskFunctions.get(DEFAULT_TASK_NAME).taskFunction()).toBe(3)

      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'remove',
        taskFunctionProperties: { name: 'fn2' },
      })
      expect(worker.taskFunctions.get(DEFAULT_TASK_NAME).taskFunction()).toBe(2)
      expect(worker.listTaskFunctionsProperties()[1].name).toBe('fn2')
    })

    it('keeps direct worker removal permanently deleting a static function', () => {
      const worker = new ThreadWorker({ fn1: () => 1, fn2: () => 2 })
      stub(worker, 'sendToMainWorker').returns()

      expect(worker.removeTaskFunction('fn2')).toStrictEqual({ status: true })

      expect(worker.taskFunctions.has('fn2')).toBe(false)
    })

    it('Verify that handleTaskFunctionOperationMessage() handles default operation', () => {
      const fn1 = () => 1
      const fn2 = () => 2
      const worker = new ThreadWorker({ fn1, fn2 })
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'default',
        taskFunctionProperties: { name: 'fn2' },
      })
      expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
        worker.taskFunctions.get('fn2')
      )
      expect(sendToMainWorkerStub.callCount).toBe(2)
      const lastCall = sendToMainWorkerStub.getCall(1)
      expect(lastCall.args[0].taskFunctionOperationStatus).toBe(true)
    })

    it('Verify that handleTaskFunctionOperationMessage() handles unknown operation', () => {
      const worker = new ThreadWorker(() => {})
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'unknown',
        taskFunctionProperties: { name: 'fn' },
      })
      expect(sendToMainWorkerStub.callCount).toBe(1)
      const lastCall = sendToMainWorkerStub.getCall(0)
      expect(lastCall.args[0].taskFunctionOperationStatus).toBe(false)
      expect(lastCall.args[0].workerError.error.message).toMatch(
        /Unknown task function operation/
      )
    })

    it('Verify that handleTaskFunctionOperationMessage() throws without properties', () => {
      const worker = new ThreadWorker(() => {})
      expect(() =>
        worker.handleTaskFunctionOperationMessage({
          taskFunctionOperation: 'add',
        })
      ).toThrow(
        /Cannot handle task function operation message without task function properties/
      )
    })

    it('Verify that handleTaskFunctionOperationMessage() throws add without function', () => {
      const worker = new ThreadWorker(() => {})
      expect(() =>
        worker.handleTaskFunctionOperationMessage({
          taskFunctionOperation: 'add',
          taskFunctionProperties: { name: 'fn' },
        })
      ).toThrow(
        /Cannot handle task function operation add message without task function/
      )
    })
  })

  describe('Check active mechanism', () => {
    it('Verify that startCheckActive() starts the interval', () => {
      const worker = new ThreadWorker(() => {})
      expect(worker.activeInterval).toBeUndefined()
      worker.startCheckActive()
      expect(worker.activeInterval).toBeDefined()
      worker.stopCheckActive()
    })

    it('Verify that stopCheckActive() stops the interval', () => {
      const worker = new ThreadWorker(() => {})
      worker.startCheckActive()
      expect(worker.activeInterval).toBeDefined()
      worker.stopCheckActive()
      expect(worker.activeInterval).toBeUndefined()
    })

    it('Verify that checkActive() sends kill on inactivity', async () => {
      const worker = new ThreadWorker(() => {}, { maxInactiveTime: 10 })
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker').returns()
      worker.startCheckActive()
      await sleep(20)
      expect(sendToMainWorkerStub.called).toBe(true)
      expect(
        sendToMainWorkerStub.calledWith({ kill: KillBehaviors.SOFT })
      ).toBe(true)
      worker.stopCheckActive()
    })
  })
})
