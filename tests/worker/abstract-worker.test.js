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

  it('Verify that fn parameter is mandatory', () => {
    expect(() => new ClusterWorker()).toThrowError('fn parameter is mandatory')
  })

  it('Verify that fn parameter is a function', () => {
    expect(() => new ClusterWorker({})).toThrowError(
      new TypeError('fn parameter is not a function')
    )
    expect(() => new ClusterWorker('')).toThrowError(
      new TypeError('fn parameter is not a function')
    )
  })

  it('Verify that async fn parameter without async option throw error', () => {
    const fn = async () => {
      return new Promise()
    }
    expect(() => new ClusterWorker(fn)).toThrowError(
      'fn parameter is an async function, please set the async option to true'
    )
  })

  it('Verify that handleError function is working properly', () => {
    const error = new Error('My error')
    const worker = new ThreadWorker(() => {})
    expect(worker.handleError(error)).toStrictEqual(error)
  })

  it('Verify that get main worker throw error if main worker is not set', () => {
    expect(() =>
      new StubPoolWithIsMainWorker(() => {}).getMainWorker()
    ).toThrowError('Main worker was not set')
  })
})
