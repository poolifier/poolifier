'use strict'
const { ThreadWorker } = require('../../lib/workers')

function test (data) {}

module.exports = new ThreadWorker(test, { maxInactiveTime: 500 })
