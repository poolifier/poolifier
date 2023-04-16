'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib')

function test () {}

module.exports = new ThreadWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
