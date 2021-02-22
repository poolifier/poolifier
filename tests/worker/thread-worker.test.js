const expect = require('expect')
const { ThreadWorker } = require('../../lib')

let numberOfMessagesPosted = 0
const postMessage = function () {
  numberOfMessagesPosted++
}
class SpyWorker extends ThreadWorker {
  getMainWorker () {
    return { postMessage: postMessage }
  }
}

describe('Thread worker test suite', () => {
  it('Verify worker has default maxInactiveTime', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.maxInactiveTime).toEqual(60_000)
  })

  it('Verify worker invoke the getMainWorker and postMessage methods', () => {
    const worker = new SpyWorker(() => {})
    worker.sendToMainWorker({ ok: 1 })
    expect(numberOfMessagesPosted).toBe(1)
  })
})
