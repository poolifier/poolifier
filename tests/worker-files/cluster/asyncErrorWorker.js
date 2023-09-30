'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib')
const { sleepTaskFunction } = require('../../test-utils.js')

async function error (data) {
  return sleepTaskFunction(
    data,
    2000,
    true,
    'Error Message from ClusterWorker:async'
  )
}

module.exports = new ClusterWorker(error, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
