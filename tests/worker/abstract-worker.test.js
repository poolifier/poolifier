const expect = require('expect')
const { ClusterWorker, KillBehaviors, ThreadWorker } = require('../../lib')

class StubPoolWithIsMainWorker extends ThreadWorker {
  constructor (fn, opts) {
    super(fn, opts)
    this.mainWorker = false
  }
}

describe('Abstract worker test suite', () => {
  it('Verify that fn function is mandatory', () => {
    expect(() => new ClusterWorker()).toThrowError(
      new Error('fn parameter is mandatory')
    )
  })

  it('Verify worker default values', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.maxInactiveTime).toBe(1000 * 60)
    expect(worker.killBehavior).toBe(KillBehaviors.SOFT)
    expect(worker.async).toBe(false)
  })

  it('Verify that worker options are set at worker creation', () => {
    const worker = new ClusterWorker(() => {}, {
      maxInactiveTime: 6000,
      async: true,
      killBehavior: KillBehaviors.HARD
    })
    expect(worker.maxInactiveTime).toBe(6000)
    expect(worker.killBehavior).toBe(KillBehaviors.HARD)
    expect(worker.async).toBe(true)
  })

  it('Verify that handleError function is working properly', () => {
    const error = new Error('My error')
    const worker = new ThreadWorker(() => {})
    expect(worker.handleError(error)).toBe(error)
  })

  it('Verify that get main worker throw error if main worker is not set', () => {
    expect(() =>
      new StubPoolWithIsMainWorker(() => {}).getMainWorker()
    ).toThrowError(new Error('Main worker was not set'))
  })
})
