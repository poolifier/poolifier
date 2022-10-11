'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index')
const { isMaster } = require('cluster')
const TestUtils = require('../../test-utils')
const { WorkerFunctions } = require('../../test-types')

function test (data) {
  data = data || {}
  data.function = data.function || WorkerFunctions.jsonIntegerSerialization
  TestUtils.executeWorkerFunction(data)
  return isMaster
}

module.exports = new ClusterWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
