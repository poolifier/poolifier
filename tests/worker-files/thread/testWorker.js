'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib')
const { executeWorkerFunction } = require('../../test-utils')
const { WorkerFunctions } = require('../../test-types')

function test (data) {
  data = data || {}
  data.function = data.function || WorkerFunctions.jsonIntegerSerialization
  return executeWorkerFunction(data)
}

module.exports = new ThreadWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
