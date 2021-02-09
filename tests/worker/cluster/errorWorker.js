'use strict'
const { ClusterWorker } = require('../../../lib/index')

function error (data) {
  // eslint-disable-next-line no-throw-literal
  throw 'Error Message from ClusterWorker'
}

module.exports = new ClusterWorker(error, { maxInactiveTime: 500 })
