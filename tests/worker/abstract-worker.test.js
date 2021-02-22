const expect = require('expect')
const { ThreadWorker } = require('../../lib')

describe('Abstract worker test suite', () => {
  it('Verify that fn function is mandatory', () => {
    expect(() => new ThreadWorker()).toThrowError(
      new Error('fn parameter is mandatory')
    )
  })
})
