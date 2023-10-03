'use strict'
const { ClusterWorker } = require('../../../lib')
const { sleepTaskFunction } = require('../../test-utils.js')

async function sleep (data) {
  return sleepTaskFunction(data, 50000)
}

module.exports = new ClusterWorker(sleep, {
  maxInactiveTime: 500
})
