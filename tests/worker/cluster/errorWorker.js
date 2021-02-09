'use strict'
const { ClusterWorker } = require('../../../lib/index')

function error (data) {
  throw new Error(data)
}

module.exports = new ClusterWorker(error, { maxInactiveTime: 500 })
