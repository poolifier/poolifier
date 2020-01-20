'use strict'
const { ThreadWorker } = require('../lib/workers')
const { isMainThread } = require('worker_threads')

class MyWorker extends ThreadWorker {
  constructor () {
    super((data) => {
      for (let i = 0; i <= 50; i++) {
        const o = {
          a: i
        }
        JSON.stringify(o)
      }
      return isMainThread
    }, { maxInactiveTime: 500 })
  }
}

module.exports = new MyWorker()
