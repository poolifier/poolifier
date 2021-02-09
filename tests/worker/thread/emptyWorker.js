'use strict'
const { ThreadWorker } = require('../../../lib/index')

function test (data) {}

module.exports = new ThreadWorker(test, { maxInactiveTime: 500 })
