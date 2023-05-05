const { expect } = require('expect')
const { ClusterWorker, KillBehaviors, ThreadWorker } = require('../../lib')

describe('Abstract worker test suite', () => {
  class StubPoolWithIsMainWorker extends ThreadWorker {
    constructor (fn, opts) {
      super(fn, opts)
      this.mainWorker = undefined
    }
  }

  it('Verify worker options default values', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.opts.maxInactiveTime).toStrictEqual(60000)
    expect(worker.opts.killBehavior).toBe(KillBehaviors.SOFT)
    expect(worker.opts.async).toBe(false)
  })

  it('Verify that worker options are set at worker creation', () => {
    const worker = new ClusterWorker(() => {}, {
      maxInactiveTime: 6000,
      async: true,
      killBehavior: KillBehaviors.HARD
    })
    expect(worker.opts.maxInactiveTime).toStrictEqual(6000)
    expect(worker.opts.killBehavior).toBe(KillBehaviors.HARD)
    expect(worker.opts.async).toBe(true)
  })

  it('Verify that taskFunctions parameter is mandatory', () => {
    expect(() => new ClusterWorker()).toThrowError(
      'taskFunctions parameter is mandatory'
    )
  })

  it('Verify that taskFunctions parameter is a function or an object', () => {
    expect(() => new ClusterWorker(0)).toThrowError(
      new TypeError('taskFunctions parameter is not a function or an object')
    )
    expect(() => new ClusterWorker('')).toThrowError(
      new TypeError('taskFunctions parameter is not a function or an object')
    )
    expect(() => new ClusterWorker(true)).toThrowError(
      new TypeError('taskFunctions parameter is not a function or an object')
    )
  })

  it('Verify that taskFunctions parameter is an object literal', () => {
    expect(() => new ClusterWorker([])).toThrowError(
      new TypeError('taskFunctions parameter is not an object literal')
    )
    expect(() => new ClusterWorker(new Map())).toThrowError(
      new TypeError('taskFunctions parameter is not an object literal')
    )
    expect(() => new ClusterWorker(new Set())).toThrowError(
      new TypeError('taskFunctions parameter is not an object literal')
    )
    expect(() => new ClusterWorker(new WeakMap())).toThrowError(
      new TypeError('taskFunctions parameter is not an object literal')
    )
    expect(() => new ClusterWorker(new WeakSet())).toThrowError(
      new TypeError('taskFunctions parameter is not an object literal')
    )
  })

  it('Verify that taskFunctions parameter with multiple task functions is taken', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ClusterWorker({ fn1, fn2 })
    expect(typeof worker.taskFunctions.get('default') === 'function').toBe(true)
    expect(typeof worker.taskFunctions.get('fn1') === 'function').toBe(true)
    expect(typeof worker.taskFunctions.get('fn2') === 'function').toBe(true)
  })

  it('Verify that handleError() method is working properly', () => {
    const error = new Error('My error')
    const worker = new ThreadWorker(() => {})
    expect(worker.handleError(error)).toStrictEqual(error)
  })

  it('Verify that getMainWorker() throw error if main worker is not set', () => {
    expect(() =>
      new StubPoolWithIsMainWorker(() => {}).getMainWorker()
    ).toThrowError('Main worker was not set')
  })
})
