'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib/index')
const { isMainThread } = require('worker_threads')
const TestUtils = require('../../test-utils')

function test (data) {
  // for (let i = 0; i < 50; i++) {
  //   const o = {
  //     a: i
  //   }
  //   JSON.stringify(o)
  // }
  TestUtils.fibonacci(40)
  return isMainThread
}

module.exports = new ThreadWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
