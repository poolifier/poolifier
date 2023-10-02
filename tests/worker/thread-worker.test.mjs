import { expect } from 'expect'
import { ThreadWorker } from '../../lib/index.js'

describe('Thread worker test suite', () => {
  let numberOfMessagesPosted = 0
  const postMessage = () => {
    ++numberOfMessagesPosted
  }
  class SpyWorker extends ThreadWorker {
    constructor (fn) {
      super(fn)
      this.port = { postMessage }
    }
  }

  it('Verify that handleError() method is working properly', () => {
    const error = new Error('Error as an error')
    const worker = new ThreadWorker(() => {})
    expect(worker.handleError(error)).toBeInstanceOf(Error)
    expect(worker.handleError(error)).toStrictEqual(error)
    const errorMessage = 'Error as a string'
    expect(worker.handleError(errorMessage)).toStrictEqual(errorMessage)
  })

  it('Verify worker invokes the postMessage() method on port property', () => {
    const worker = new SpyWorker(() => {})
    worker.sendToMainWorker({ ok: 1 })
    expect(numberOfMessagesPosted).toBe(1)
  })
})
