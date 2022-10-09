'use strict'
const { isMaster } = require('cluster')
const { ClusterWorker } = require('../../../lib/index')
const { jsonIntegerSerialization } = require('../benchmark-utils')

const debug = false

function yourFunction (data) {
  jsonIntegerSerialization(1000)
  debug === true && console.debug('This is the main thread ' + isMaster)
  return { ok: 1 }
}

module.exports = new ClusterWorker(yourFunction)
