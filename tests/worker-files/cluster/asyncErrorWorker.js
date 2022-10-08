'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index')
const TestUtils = require('../../test-utils')

async function error (data) {
  return TestUtils.workerSleepFunction(
    data,
    2000,
    true,
    'Error Message from ClusterWorker:async'
  )
}

module.exports = new ClusterWorker(error, {
  maxInactiveTime: 500,
  async: true,
  killBehavior: KillBehaviors.HARD
})
