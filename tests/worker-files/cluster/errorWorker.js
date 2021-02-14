'use strict'
const { ClusterWorker } = require('../../../lib/index')

function error (data) {
  throw new Error('Error Message from ClusterWorker')
}

module.exports = new ClusterWorker(error, {
  maxInactiveTime: 500,
  async: false
})
