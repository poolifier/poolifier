'use strict'
const { isMaster } = require('cluster')
const { ClusterWorker, KillBehaviors } = require('../../../lib')
const { executeWorkerFunction } = require('../../test-utils')
const { WorkerFunctions } = require('../../test-types')

function test (data) {
  data = data || {}
  data.function = data.function || WorkerFunctions.jsonIntegerSerialization
  const result = executeWorkerFunction(data)
  if (result == null) {
    return isMaster
  }
  return result
}

module.exports = new ClusterWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
