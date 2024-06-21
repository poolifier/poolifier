'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/**
 *
 * @param data
 * @returns
 */
function echo (data) {
  return data
}

module.exports = new ClusterWorker(echo, {
  killBehavior: KillBehaviors.HARD,
})
