'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')
const { executeTaskFunction } = require('../../test-utils.js')
const { TaskFunctions } = require('../../test-types.js')

function test (data) {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  return executeTaskFunction(data)
}

module.exports = new ClusterWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
