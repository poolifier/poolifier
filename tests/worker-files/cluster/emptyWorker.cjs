'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

function test () {}

module.exports = new ClusterWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
