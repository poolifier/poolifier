'use strict'
const {
  Worker, isMainThread, MessageChannel, SHARE_ENV
} = require('worker_threads')
const path = require('path')

// FixedThreadPool , TrampolineThreadPool
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
    this.numThreads = numThreads || 10
    this.workers = []
    this.nextWorker = 0
    process.env.proof = (data) => console.log(data)
    for (let i = 1; i <= numThreads; i++) {
      const worker = new Worker(path.resolve(filename), { env: SHARE_ENV })
      worker.on('error', (e) => console.error(e))
      worker.on('exit', () => console.log('EXITING'))
      this.workers.push(worker)
      const { port1, port2 } = new MessageChannel()
      // send the port to communicate with the main thread to the worker
      /* port2.on('message' , (message) => {
        console.log('Worker is sending a message : ' + message)
      }) */
      worker.postMessage({ parent: port1 }, [port1])
      worker.port1 = port1
      worker.port2 = port2
    }
  }

  /**
   *
   * @param {Function} task , a function to execute
   * @param {Any} the input for the task specified
   */
  async execute (data) {
    // configure worker to handle message with the specified task
    const worker = this._chooseWorker()
    const id = generateID()
    data._id = id
    const res = this._execute(worker, id)
    worker.postMessage(data)
    return res
  }

  _execute (worker, id) {
    return new Promise((resolve, reject) => {
      const listener =  (message) =>  {
        if (message._id === id) {
          console.log('Received a message from worker : ' + message.data)
          worker.port2.removeListener('message' , listener)
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
}

/**
 * Return an id to be associated to a node.
 */
const generateID = () => {
  return Math.random()
    .toString(36)
    .substring(2)
}

module.exports = FixedThreadPool
