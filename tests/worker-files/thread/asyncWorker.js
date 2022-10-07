'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib/index')
const TestUtils = require('../../test-utils')

async function sleep (data) {
  return await TestUtils.workerSleepFunction(data, 2000)
}

module.exports = new ThreadWorker(sleep, {
  maxInactiveTime: 500,
  async: true,
  killBehavior: KillBehaviors.HARD
})
