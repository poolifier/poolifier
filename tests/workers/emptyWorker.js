'use strict'
const { ThreadWorker } = require('../../lib/workers')

function test (data) {
}

class MyWorker extends ThreadWorker {
  constructor () {
    super(test, { maxInactiveTime: 500 })
  }
}

module.exports = new MyWorker()
