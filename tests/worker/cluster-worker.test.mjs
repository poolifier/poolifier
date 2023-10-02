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

  it('Verify that handleError() method is working properly', () => {
    const error = new Error('Error as an error')
    const worker = new ClusterWorker(() => {})
    expect(worker.handleError(error)).not.toBeInstanceOf(Error)
    expect(worker.handleError(error)).toStrictEqual(error.message)
    const errorMessage = 'Error as a string'
    expect(worker.handleError(errorMessage)).toStrictEqual(errorMessage)
  })

  it('Verify worker invokes the getMainWorker() and send() methods', () => {
    const worker = new SpyWorker(() => {})
    worker.sendToMainWorker({ ok: 1 })
    expect(numberOfMessagesSent).toBe(1)
  })
})
