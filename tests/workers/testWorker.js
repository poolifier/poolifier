'use strict'
const { ThreadWorker } = require('../../lib/workers')
const { isMainThread } = require('worker_threads')

function test (data) {
  for (let i = 0; i <= 50; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
  return isMainThread
}

class MyWorker extends ThreadWorker {
  constructor () {
    super(test, { maxInactiveTime: 500 })
  }
}

module.exports = new MyWorker()
