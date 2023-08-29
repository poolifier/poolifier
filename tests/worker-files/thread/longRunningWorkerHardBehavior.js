'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib')
const { sleepTaskFunction } = require('../../test-utils')

async function sleep (data) {
  return sleepTaskFunction(data, 50000)
}

module.exports = new ThreadWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
