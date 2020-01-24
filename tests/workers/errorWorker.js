'use strict'
const { ThreadWorker } = require('../../lib/workers')

function error (data) {
  throw new Error(data)
}

module.exports = new ThreadWorker(error, { maxInactiveTime: 500 })
