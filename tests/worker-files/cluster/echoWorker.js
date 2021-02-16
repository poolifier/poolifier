'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index')

function echo (data) {
  return data
}

module.exports = new ClusterWorker(echo, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
