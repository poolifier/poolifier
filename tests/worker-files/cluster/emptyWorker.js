'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index')

function test (data) {}

module.exports = new ClusterWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
