'use strict'
const ThreadWorker = require('./worker')
const { isMainThread } = require('worker_threads')

class MyWorker extends ThreadWorker {
  constructor () {
    super((data) => {
      // console.log('This is the main thread ' + isMainThread)
      // this.parent.postMessage(JSON.stringify(data))
      return JSON.stringify(data)
    })
  }
}

module.exports = new MyWorker()
