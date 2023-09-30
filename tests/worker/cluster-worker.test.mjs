import { expect } from 'expect'
import { ClusterWorker } from '../../lib/index.js'

describe('Cluster worker test suite', () => {
  let numberOfMessagesSent = 0
  const send = () => {
    ++numberOfMessagesSent
  }
  class SpyWorker extends ClusterWorker {
    getMainWorker () {
      return { send }
    }
  }

  it('Verify worker invokes the getMainWorker() and send() methods', () => {
    const worker = new SpyWorker(() => {})
    worker.sendToMainWorker({ ok: 1 })
    expect(numberOfMessagesSent).toBe(1)
  })
})
