'use strict'
const { ClusterWorker } = require('../../../lib/index')
const { jsonIntegerSerialization } = require('../benchmark-utils')

function yourFunction (data) {
  jsonIntegerSerialization(1000)
  // console.log('This is the main thread ' + isMaster)
  return { ok: 1 }
}

module.exports = new ClusterWorker(yourFunction)
