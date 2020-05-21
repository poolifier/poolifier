'use strict'
const {
  isMainThread, parentPort
} = require('worker_threads')
const { AsyncResource } = require('async_hooks')

/**
 * An example worker that will be always alive, you just need to extend this class if you want a static pool.<br>
 * When this worker is inactive for more than 1 minute, it will send this info to the main thread,<br>
 * if you are using DynamicThreadPool, the workers created after will be killed, the min num of thread will be guaranteed
 * @author Alessandro Pio Ardizio
 * @since 0.0.1
 */
class ThreadWorker extends AsyncResource {
  constructor (fn, opts) {
    super('worker-thread-pool:pioardi')
    this.opts = opts || {}
    this.maxInactiveTime = this.opts.maxInactiveTime || (1000 * 60)
    this.async = !!this.opts.async
    this.lastTask = Date.now()
    if (!fn) throw new Error('Fn parameter is mandatory')
    // keep the worker active
    if (!isMainThread) {
      this.interval = setInterval(this._checkAlive.bind(this), this.maxInactiveTime / 2)
      this._checkAlive.bind(this)()
    }
    parentPort.on('message', (value) => {
      if (value && value.data && value._id) {
        // here you will receive messages
        // console.log('This is the main thread ' + isMainThread)
        if (this.async) {
          this.runInAsyncScope(this._runAsync.bind(this), this, fn, value)
        } else {
          this.runInAsyncScope(this._run.bind(this), this, fn, value)
        }
      } else if (value.parent) {
        // save the port to communicate with the main thread
        // this will be received once
        this.parent = value.parent
      } else if (value.kill) {
        // here is time to kill this thread, just clearing the interval
        clearInterval(this.interval)
        this.emitDestroy()
      }
    })
  }

  _checkAlive () {
    if ((Date.now() - this.lastTask) > this.maxInactiveTime) {
      this.parent.postMessage({ kill: 1 })
    }
  }

  _run (fn, value) {
    try {
      const res = fn(value.data)
      this.parent.postMessage({ data: res, _id: value._id })
      this.lastTask = Date.now()
    } catch (e) {
      this.parent.postMessage({ error: e, _id: value._id })
      this.lastTask = Date.now()
    }
  }

  _runAsync (fn, value) {
    fn(value.data).then(res => {
      this.parent.postMessage({ data: res, _id: value._id })
      this.lastTask = Date.now()
    }).catch(e => {
      this.parent.postMessage({ error: e, _id: value._id })
      this.lastTask = Date.now()
    })
  }
}

module.exports.ThreadWorker = ThreadWorker
