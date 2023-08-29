'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')

function test () {}

module.exports = new ClusterWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
