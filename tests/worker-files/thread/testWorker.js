'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib/index')
const { isMainThread } = require('worker_threads')
const TestUtils = require('../../test-utils')

function test (data) {
  // TestUtils.jsonIntegerSerialization(100)
  TestUtils.fibonacci(40)
  return isMainThread
}

module.exports = new ThreadWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
