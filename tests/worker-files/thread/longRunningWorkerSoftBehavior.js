'use strict'
const { ThreadWorker } = require('../../../lib/index')
const TestUtils = require('../../test-utils')

async function sleep (data) {
  return await TestUtils.workerSleepFunction(data, 50000)
}

module.exports = new ThreadWorker(sleep, {
  maxInactiveTime: 500,
  async: true
})
