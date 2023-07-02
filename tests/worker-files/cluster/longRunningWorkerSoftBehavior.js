'use strict'
const { ClusterWorker } = require('../../../lib')
const { sleepWorkerFunction } = require('../../test-utils')

async function sleep (data) {
  return sleepWorkerFunction(data, 50000)
}

module.exports = new ClusterWorker(sleep, {
  maxInactiveTime: 500
})
