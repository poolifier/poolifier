const expect = require('expect')
const { ClusterWorker } = require('../../lib')

describe('Cluster worker test suite', () => {
  // Skipped because ClusterWorker would be in main instead of non-main worker
  it.skip('Verify worker has default maxInactiveTime', () => {
    const worker = new ClusterWorker(() => {})
    expect(worker.maxInactiveTime).toEqual(60_000)
  })
})
