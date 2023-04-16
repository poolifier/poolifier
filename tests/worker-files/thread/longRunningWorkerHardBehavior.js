'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib')
const TestUtils = require('../../test-utils')

async function sleep (data) {
  return TestUtils.sleepWorkerFunction(data, 50000)
}

module.exports = new ThreadWorker(sleep, {
  maxInactiveTime: 500,
  async: true,
  killBehavior: KillBehaviors.HARD
})
