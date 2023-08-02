'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')
const { executeTaskFunction } = require('../../test-utils')
const { TaskFunctions } = require('../../test-types')

function test (data) {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  return executeTaskFunction(data)
}

module.exports = new ClusterWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
