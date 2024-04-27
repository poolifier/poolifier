import { expect } from 'expect'
import { restore, stub } from 'sinon'

import { ThreadWorker } from '../../lib/index.cjs'
import { DEFAULT_TASK_NAME } from '../../lib/utils.cjs'

describe('Thread worker test suite', () => {
  afterEach(() => {
    restore()
  })

  it('Verify worker properties value after initialization', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.isMain).toBe(true)
    expect(worker.mainWorker).toBe(null)
    expect(worker.taskFunctions).toBeInstanceOf(Map)
    expect(worker.taskFunctions.size).toBe(2)
  })

  it('Verify that sync kill handler is called when worker is killed', () => {
    const worker = new ThreadWorker(() => {}, {
      killHandler: stub().returns()
    })
    worker.isMain = false
    worker.port = {
      postMessage: stub().returns(),
      unref: stub().returns(),
      close: stub().returns()
    }
    worker.handleKillMessage()
    expect(worker.port.postMessage.calledOnce).toBe(true)
    expect(worker.port.unref.calledOnce).toBe(true)
    expect(worker.port.close.calledOnce).toBe(true)
    expect(worker.opts.killHandler.calledOnce).toBe(true)
  })

  it('Verify that removeTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    worker.port = {
      postMessage: stub().returns()
    }
    expect(worker.removeTaskFunction(0, fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is not a string')
    })
    expect(worker.removeTaskFunction('', fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is an empty string')
    })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(Object)
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Object)
    expect(worker.taskFunctions.get('fn2')).toBeInstanceOf(Object)
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
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(Object)
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Object)
    expect(worker.taskFunctions.get('fn2')).toBeUndefined()
    expect(worker.taskFunctions.size).toBe(2)
    expect(worker.port.postMessage.calledOnce).toBe(true)
  })

  it('Verify that handleError() method is working properly', () => {
    const error = new Error('Error as an error')
    const worker = new ThreadWorker(() => {})
    expect(worker.handleError(error)).toBeInstanceOf(Error)
    expect(worker.handleError(error)).toStrictEqual(error)
    const errorMessage = 'Error as a string'
    expect(worker.handleError(errorMessage)).toStrictEqual(errorMessage)
  })

  it('Verify that sendToMainWorker() method invokes the port property postMessage() method', () => {
    const worker = new ThreadWorker(() => {})
    worker.port = { postMessage: stub().returns() }
    worker.sendToMainWorker({ ok: 1 })
    expect(worker.port.postMessage.calledOnce).toBe(true)
  })
})
