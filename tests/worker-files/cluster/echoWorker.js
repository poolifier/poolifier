'use strict'
const { ClusterWorker } = require('../../../lib/index')

function echo (data) {
  return data
}

module.exports = new ClusterWorker(echo)
