'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib')
const TestUtils = require('../../test-utils')

async function error (data) {
  return TestUtils.sleepWorkerFunction(
    data,
    2000,
    true,
    'Error Message from ThreadWorker:async'
  )
}

module.exports = new ThreadWorker(error, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
