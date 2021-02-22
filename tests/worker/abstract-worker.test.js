const expect = require('expect')
const { ClusterWorker } = require('../../lib')

describe('Abstract worker test suite', () => {
  it('Verify that fn function is mandatory', () => {
    expect(() => new ClusterWorker()).toThrowError(
      new Error('fn parameter is mandatory')
    )
  })
})
