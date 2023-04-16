'use strict'
const { ClusterWorker } = require('../../../lib')
const TestUtils = require('../../test-utils')

async function sleep (data) {
  return TestUtils.sleepWorkerFunction(data, 50000)
}

module.exports = new ClusterWorker(sleep, {
  maxInactiveTime: 500,
  async: true
})
