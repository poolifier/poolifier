'use strict'
const {
  isMainThread, parentPort
} = require('worker_threads')

/**
 * An example worker that will be always alive, you just need to extend this class if you want a static pool.
 * @author Alessandro Pio Ardizio
 * @since 0.0.1
 */
class ThreadWorker {
  constructor (fn) {
    if (!fn) throw new Error('Fn parameter is mandatory')
    // keep the worker active
    if (!isMainThread) {
      this.interval =
      setInterval(() => {
      }, 10000)
    }
    parentPort.on('message', (value) => {
      if (value.parent) {
        // save the port to communicate with the main thread
        this.parent = value.parent
      } else if (value && value._id) {
        // console.log('This is the main thread ' + isMainThread)
        this.parent.postMessage({ data: fn(value), _id: value._id })
      }
    })
  }
}

module.exports = ThreadWorker
