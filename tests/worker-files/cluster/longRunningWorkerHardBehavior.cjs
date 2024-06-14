'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')
const { sleepTaskFunction } = require('../../test-utils.cjs')

/**
 *
 * @param data
 * @returns
 */
async function sleep (data) {
  return sleepTaskFunction(data, 50000)
}

module.exports = new ClusterWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
