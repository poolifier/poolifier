'use strict'
const { ClusterWorker, killBehaviorEnumeration } = require('../../../lib/index')

function echo (data) {
  return data
}

module.exports = new ClusterWorker(echo, {
  maxInactiveTime: 500,
  killBehavior: killBehaviorEnumeration.HARD
})
