'use strict'
const { ClusterWorker, killBehaviorEnumeration } = require('../../../lib/index')

function test (data) {}

module.exports = new ClusterWorker(test, {
  maxInactiveTime: 500,
  killBehavior: killBehaviorEnumeration.HARD
})
