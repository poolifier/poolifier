const expect = require('expect')
const { ClusterWorker, ThreadWorker } = require('../../lib')

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

  it('Verify that handle Error function is working properly', () => {
    const error = new Error('My error')
    const worker = new ThreadWorker(() => {})
    expect(worker.handleError(error)).toBe(error)
  })

  it('Verify that get main worker throw error if main worker is not set', () => {
    expect(() =>
      new StubPoolWithIsMainWorker(() => {}).getMainWorker()
    ).toThrowError()
  })
})
