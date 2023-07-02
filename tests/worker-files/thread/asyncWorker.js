'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib')
const { sleepWorkerFunction } = require('../../test-utils')

async function sleep (data) {
  return sleepWorkerFunction(data, 2000)
}

module.exports = new ThreadWorker(sleep, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
