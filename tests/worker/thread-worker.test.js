const expect = require('expect')
const { ThreadWorker } = require('../../lib')

describe('Thread worker test suite', () => {
  it('Verify worker has default maxInactiveTime', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.maxInactiveTime).toEqual(60_000)
  })
})
