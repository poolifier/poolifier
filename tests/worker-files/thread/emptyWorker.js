'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib')

function test () {}

module.exports = new ThreadWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
