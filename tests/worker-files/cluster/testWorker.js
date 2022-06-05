'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index')
const { isMaster } = require('cluster')
const TestUtils = require('../../test-utils')

function test (data) {
  // for (let i = 0; i < 50; i++) {
  //   const o = {
  //     a: i
  //   }
  //   JSON.stringify(o)
  // }
  TestUtils.fibonacci(30)
  return isMaster
}

module.exports = new ClusterWorker(test, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
