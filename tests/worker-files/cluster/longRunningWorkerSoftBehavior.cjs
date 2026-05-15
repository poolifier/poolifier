'use strict'
const { ClusterWorker } = require('../../../lib/index.cjs')
const { sleepTaskFunction } = require('../../test-utils.cjs')

/**
 * Test worker function that performs a long-running sleep operation with soft behavior.
 * @param data - The task data.
 * @returns The result of the sleep operation.
 */
async function sleep (data) {
  return sleepTaskFunction(data, 50000)
}

module.exports = new ClusterWorker(sleep, {
  maxInactiveTime: 500,
})
