'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const { executeTaskFunction } = require('../../test-utils.cjs')
const { TaskFunctions } = require('../../test-types.cjs')

/**
 *
 * @param data
 */
function test (data) {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  return executeTaskFunction(data)
}

module.exports = new ClusterWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
