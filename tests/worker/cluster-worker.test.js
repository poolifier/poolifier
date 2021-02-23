const expect = require('expect')
const { ClusterWorker } = require('../../lib')

describe('Cluster worker test suite', () => {
  it('Verify worker has default maxInactiveTime', () => {
    const worker = new ClusterWorker(() => {})
    expect(worker.maxInactiveTime).toEqual(60_000)
  })

  it('Verify that handleError function works properly', () => {
    const errorMessage = 'Error as a string'
    const worker = new ClusterWorker(() => {})
    expect(worker.handleError(errorMessage)).toBe(errorMessage)
  })
})
