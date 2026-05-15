'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const { TaskFunctions } = require('../../test-types.cjs')
const { executeTaskFunction } = require('../../test-utils.cjs')

/**
 * Test worker function that executes configurable task functions for testing.
 * @param data - The task data containing function configuration.
 * @returns The result of the executed task function.
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
