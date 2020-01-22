'use strict'
const { ThreadWorker } = require('../../lib/workers')

function error (data) {
  throw new Error(data)
}

class MyWorker extends ThreadWorker {
  constructor () {
    super(error, { maxInactiveTime: 500 })
  }
}

module.exports = new MyWorker()
