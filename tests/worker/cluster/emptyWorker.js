'use strict'
const { ClusterWorker } = require('../../../lib/index')

function test (data) {}

module.exports = new ClusterWorker(test, { maxInactiveTime: 500 })
