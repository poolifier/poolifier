'use strict'
const { ThreadWorker } = require('../../../lib')
const { sleepWorkerFunction } = require('../../test-utils')

async function sleep (data) {
  return sleepWorkerFunction(data, 50000)
}

module.exports = new ThreadWorker(sleep, {
  maxInactiveTime: 500
})
