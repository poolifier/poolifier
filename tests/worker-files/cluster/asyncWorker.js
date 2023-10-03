'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')
const { sleepTaskFunction } = require('../../test-utils.js')

async function sleep (data) {
  return sleepTaskFunction(data, 2000)
}

module.exports = new ClusterWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
