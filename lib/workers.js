'use strict'
const {
  isMainThread, parentPort
} = require('worker_threads')
const { AsyncResource } = require('async_hooks')
const maxInactiveTime = 1000 * 60

/**
 * An example worker that will be always alive, you just need to extend this class if you want a static pool.<br>
 * When this worker is inactive for more than 1 minute, it will send this info to the main thread,<br>
 * if you are using DynamicThreadPool, the workers created after will be killed, the min num of thread will be guaranteed
 * @author Alessandro Pio Ardizio
 * @since 0.0.1
 */
class ThreadWorker extends AsyncResource {
  constructor (fn) {
    super('worker-thread-pool:pioardi')
    this.lastTask = Date.now()
    if (!fn) throw new Error('Fn parameter is mandatory')
    // keep the worker active
    if (!isMainThread) {
      this.interval = setInterval(this._checkAlive.bind(this), maxInactiveTime)
      this._checkAlive.bind(this)()
    }
    parentPort.on('message', (value) => {
      if (value && value._id) {
        // here you will receive messages
        // console.log('This is the main thread ' + isMainThread)
        const res = this.runInAsyncScope(fn, null, value)
        this.parent.postMessage({ data: res, _id: value._id })
        this.lastTask = Date.now()
      } else if (value.parent) {
        // save the port to communicate with the main thread
        // this will be received once
        this.parent = value.parent
      } else if (value.kill) {
        // here is time to kill this thread, just clearing the interval
        clearInterval(this.interval)
      }
    })
  }

  _checkAlive () {
    if ((Date.now() - this.lastTask) > maxInactiveTime) {
      this.parent.postMessage({ kill: 1 })
    }
  }
}

module.exports.ThreadWorker = ThreadWorker
