'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const { sleepTaskFunction } = require('../../test-utils.cjs')

/**
 * Test worker function that sleeps for a specified duration.
 * @param data - The task data.
 * @returns The result after sleeping.
 */
async function sleep (data) {
  return sleepTaskFunction(data, 2000)
}

module.exports = new ClusterWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
