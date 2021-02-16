'use strict'
const { ThreadWorker, killBehaviorTypes } = require('../../../lib/index')

function test (data) {}

module.exports = new ThreadWorker(test, {
  maxInactiveTime: 500,
  killBehavior: killBehaviorTypes.HARD
})
