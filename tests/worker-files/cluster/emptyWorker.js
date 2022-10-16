'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index')

function test () {}

module.exports = new ClusterWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
