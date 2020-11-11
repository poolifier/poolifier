'use strict'
const FixedThreadPool = require('./fixed')
const EventEmitter = require('events')
class MyEmitter extends EventEmitter {}

/**
 * A thread pool with a min/max number of threads , is possible to execute tasks in sync or async mode as you prefer. <br>
 * This thread pool will create new workers when the other ones are busy, until the max number of threads,
 * when the max number of threads is reached, an event will be emitted , if you want to listen this event use the emitter method.
 * @author Alessandro Pio Ardizio
 * @since 0.0.1
 */
class DynamicThreadPool extends FixedThreadPool {
  /**
    *
    * @param {Number} min  Min number of threads that will be always active
    * @param {Number} max  Max number of threads that will be active
  */
  constructor (min, max, filename, opts) {
    super(min, filename, opts)
    this.max = max
    this.emitter = new MyEmitter()
  }

  _chooseWorker () {
    let worker
    for (const entry of this.tasks) {
      if (entry[1] === 0) {
        worker = entry[0]
        break
      }
    }

    if (worker) {
      // a worker is free, use it
      return worker
    } else {
      if (this.workers.length === this.max) {
        this.emitter.emit('FullPool')
        return super._chooseWorker()
      }
      // all workers are busy create a new worker
      const worker = this._newWorker()
      worker.port2.on('message', (message) => {
        if (message.kill) {
          worker.postMessage({ kill: 1 })
          worker.terminate()
          // clean workers from data structures
          const myIndex = this.workers.indexOf(worker)
          this.workers.splice(myIndex, 1)
          this.tasks.delete(worker)
        }
      })
      return worker
    }
  }
}

module.exports = DynamicThreadPool
