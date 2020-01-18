'use strict'
const {
  Worker, isMainThread, MessageChannel, SHARE_ENV
} = require('worker_threads')
const path = require('path')
const { generateID } = require('./util')

/**
 * A thread pool with a static number of threads , is possible to execute tasks in sync or async mode as you prefer. <br>
 * This pool will select the worker thread in a round robin fashion. <br>
 * @author Alessandro Pio Ardizio
 * @since 0.0.1
 */
class FixedThreadPool {
  /**
    *
    * @param {Number} numThreads  Num of threads for this worker pool
    * @param {Object} an object with possible options for example maxConcurrency
  */
  constructor (numThreads, filename, opts) {
    if (!isMainThread) throw new Error('Cannot start a thread pool from a worker thread !!!')
    if (!filename) throw new Error('Please specify a file with a worker implementation')
    this.numThreads = numThreads
    this.workers = []
    this.nextWorker = 0
    this.opts = opts || { maxTasks: 1000 }
    this.filename = filename
    // threadId as key and an integer value
    this.tasks = new Map()
    for (let i = 1; i <= numThreads; i++) {
      this._newWorker()
    }
  }

  /**
   * Execute the task specified into the constructor with the data parameter.
   * @param {Any} the input for the task specified
   * @returns {Promise} that is resolved when the task is done
   */
  async execute (data) {
    // configure worker to handle message with the specified task
    const worker = this._chooseWorker()
    this.tasks.set(worker, this.tasks.get(worker) + 1)
    // console.log('Num of pending tasks ', this.tasks.get(worker))
    const id = generateID()
    data._id = id
    // console.log('Worker choosed is ' + worker.threadId)
    const res = this._execute(worker, id)
    worker.postMessage(data)
    return res
  }

  _execute (worker, id) {
    return new Promise((resolve, reject) => {
      const listener = (message) => {
        if (message._id === id) {
          worker.port2.removeListener('message', listener)
          // console.log(worker.port2.listenerCount('message'))
          this.tasks.set(worker, this.tasks.get(worker) - 1)
          resolve(message.data)
        }
      }
      worker.port2.on('message', listener)
    })
  }

  _chooseWorker () {
    if ((this.workers.length - 1) === this.nextWorker) {
      this.nextWorker = 0
      return this.workers[this.nextWorker]
    } else {
      this.nextWorker++
      return this.workers[this.nextWorker]
    }
  }

  _newWorker () {
    const worker = new Worker(path.resolve(this.filename), { env: SHARE_ENV })
    worker.on('error', (e) => console.error(e))
    worker.on('exit', () => console.log('EXITING'))
    this.workers.push(worker)
    const { port1, port2 } = new MessageChannel()
    worker.postMessage({ parent: port1 }, [port1])
    worker.port1 = port1
    worker.port2 = port2
    // we will attach a listener for every task,
    // when task is completed the listener will be removed but to avoid warnings we are increasing the max listeners size
    worker.port2.setMaxListeners(this.opts.maxTasks)
    // init tasks map
    this.tasks.set(worker, 0)
    return worker
  }
}

module.exports = FixedThreadPool
