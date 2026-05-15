'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const { sleepTaskFunction } = require('../../test-utils.cjs')

/**
 * Test worker function that throws an error after sleeping.
 * @param data - The task data.
 * @returns The result after sleeping and potentially throwing an error.
 */
async function error (data) {
  return sleepTaskFunction(
    data,
    2000,
    true,
    'Error Message from ClusterWorker:async'
  )
}

module.exports = new ClusterWorker(error, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
