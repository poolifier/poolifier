'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')
const TestUtils = require('../../test-utils')

async function error (data) {
  return TestUtils.sleepWorkerFunction(
    data,
    2000,
    true,
    'Error Message from ClusterWorker:async'
  )
}

module.exports = new ClusterWorker(error, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
