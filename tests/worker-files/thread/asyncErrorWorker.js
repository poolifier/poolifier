'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib/index')
const TestUtils = require('../../test-utils')

async function error (data) {
  return TestUtils.workerSleepFunction(
    data,
    2000,
    true,
    'Error Message from ThreadWorker:async'
  )
}

module.exports = new ThreadWorker(error, {
  maxInactiveTime: 500,
  async: true,
  killBehavior: KillBehaviors.HARD
})
