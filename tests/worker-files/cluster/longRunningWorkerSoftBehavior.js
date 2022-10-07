'use strict'
const { ClusterWorker } = require('../../../lib/index')
const TestUtils = require('../../test-utils')

async function sleep (data) {
  return TestUtils.workerSleepFunction(data, 50000)
}

module.exports = new ClusterWorker(sleep, {
  maxInactiveTime: 500,
  async: true
})
