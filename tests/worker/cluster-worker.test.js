const { expect } = require('expect')
const { ClusterWorker } = require('../../lib')

describe('Cluster worker test suite', () => {
  it('Verify worker has default maxInactiveTime', () => {
    const worker = new ClusterWorker(() => {})
    expect(worker.opts.maxInactiveTime).toStrictEqual(60000)
  })

  it('Verify that handleError() method works properly', () => {
    const errorMessage = 'Error as a string'
    const worker = new ClusterWorker(() => {})
    expect(worker.handleError(errorMessage)).toStrictEqual(errorMessage)
  })
})
