'use strict'
const { ThreadWorker, killBehaviorEnumeration } = require('../../../lib/index')

function test (data) {}

module.exports = new ThreadWorker(test, {
  maxInactiveTime: 500,
  killBehavior: killBehaviorEnumeration.HARD
})
