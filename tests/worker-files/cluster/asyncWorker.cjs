'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const { sleepTaskFunction } = require('../../test-utils.cjs')

/**
 *
 * @param data
 */
async function sleep (data) {
  return sleepTaskFunction(data, 2000)
}

module.exports = new ClusterWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
