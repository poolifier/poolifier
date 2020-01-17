'use strict'
const {
  Worker, isMainThread, MessageChannel
} = require('worker_threads')

console.log('Fixed required')

// FixedThreadPool , TrampolineThreadPool
/**
 * A thread pool with a static number of threads , is possible to execute tasks in sync or async mode as you prefer
 * @author Alessandro Pio Ardizio
 * @since 0.0.1
 */
class FixedThreadPool {
  /**
     *
     * @param {Number} numThreads  Num of threads for this worker pool
     * @param {Object} an object with possible options for example maxConcurrency
     */
  constructor (numThreads, opts) {
    if (!isMainThread) {
      throw new Error('Cannot start a thread pool from a worker thread !!!')
    }
    this.numThreads = numThreads
    this.workers = []
    for (let i = 1; i <= numThreads; i++) {
      const worker = new Worker(__filename)
      this.workers.push(worker)
      const { port1, port2 } = new MessageChannel()
      worker.receiverPort = port1
      worker.sendPort = port2
    }
  }

  /**
   *
   * @param {Function} task , a function to execute
   * @param {Any} the input for the task specified
   */
  execute (task, data) {
    // TODO select a worker
    // configure worker to handle message with the specified task
    const res = this._execute(this.workers[0], task)
    this.workers[0].sendPort.postMessage(data)
    return res
  }

  _execute (worker, task) {
    return new Promise((resolve, reject) => {
      worker.receiverPort.on('message', (data) => {
        try {
          resolve(task(data))
        } catch (e) {
          reject(e)
        }
      })
    })
  }
}

module.exports = FixedThreadPool
