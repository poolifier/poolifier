'use strict'
const { ThreadWorker } = require('../../lib/workers')

function echo (data) {
  return data
}

class MyWorker extends ThreadWorker {
  constructor () {
    super(echo, { maxInactiveTime: 500 })
  }
}

module.exports = new MyWorker()
