'use strict'
const { ClusterWorker, killBehaviorTypes } = require('../../../lib/index')

function test (data) {}

module.exports = new ClusterWorker(test, {
  maxInactiveTime: 500,
  killBehavior: killBehaviorTypes.HARD
})
