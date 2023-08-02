'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')
const { sleepTaskFunction } = require('../../test-utils')

async function sleep (data) {
  return sleepTaskFunction(data, 50000)
}

module.exports = new ClusterWorker(sleep, {
  maxInactiveTime: 500,
  killBehavior: KillBehaviors.HARD
})
