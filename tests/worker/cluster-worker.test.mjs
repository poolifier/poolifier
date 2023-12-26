import { expect } from 'expect'
import { restore, stub } from 'sinon'
import { ClusterWorker } from '../../lib/index.js'
import { DEFAULT_TASK_NAME } from '../../lib/utils.js'

describe('Cluster worker test suite', () => {
  afterEach(() => {
    restore()
  })

  it('Verify that sync kill handler is called when worker is killed', () => {
    const worker = new ClusterWorker(() => {}, {
      killHandler: stub().returns()
    })
    worker.isMain = false
    worker.getMainWorker = stub().returns({
      id: 1,
      send: stub().returns()
    })
    worker.handleKillMessage()
    expect(worker.getMainWorker.calledTwice).toBe(true)
    expect(worker.getMainWorker().send.calledOnce).toBe(true)
    expect(worker.opts.killHandler.calledOnce).toBe(true)
  })

  it('Verify that removeTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ClusterWorker({ fn1, fn2 })
    worker.getMainWorker = stub().returns({
      id: 1,
      send: stub().returns()
    })
    expect(worker.removeTaskFunction(0, fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is not a string')
    })
    expect(worker.removeTaskFunction('', fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is an empty string')
    })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn2')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
    expect(worker.removeTaskFunction(DEFAULT_TASK_NAME)).toStrictEqual({
      status: false,
      error: new Error(
        'Cannot remove the task function with the default reserved name'
      )
    })
    expect(worker.removeTaskFunction('fn1')).toStrictEqual({
      status: false,
      error: new Error(
        'Cannot remove the task function used as the default task function'
      )
    })
    worker.removeTaskFunction('fn2')
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn2')).toBeUndefined()
    expect(worker.taskFunctions.size).toBe(2)
    expect(worker.getMainWorker.calledTwice).toBe(true)
    expect(worker.getMainWorker().send.calledOnce).toBe(true)
  })

  it('Verify that handleError() method is working properly', () => {
    const error = new Error('Error as an error')
    const worker = new ClusterWorker(() => {})
    expect(worker.handleError(error)).not.toBeInstanceOf(Error)
    expect(worker.handleError(error)).toStrictEqual(error.message)
    const errorMessage = 'Error as a string'
    expect(worker.handleError(errorMessage)).toStrictEqual(errorMessage)
  })

  it('Verify that sendToMainWorker() method invokes the getMainWorker() and send() methods', () => {
    const worker = new ClusterWorker(() => {})
    worker.getMainWorker = stub().returns({
      send: stub().returns()
    })
    worker.sendToMainWorker({ ok: 1 })
    expect(worker.getMainWorker.calledTwice).toBe(true)
    expect(worker.getMainWorker().send.calledOnce).toBe(true)
  })
})
