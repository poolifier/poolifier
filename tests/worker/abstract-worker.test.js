const expect = require('expect')
const { ThreadWorker } = require('../../lib')

describe('Abstract worker test suite', () => {
  it('Verify that fn function is mandatory', () => {
    expect(() => {
      const worker = new ThreadWorker()
    }).toThrowError()
  })
})
