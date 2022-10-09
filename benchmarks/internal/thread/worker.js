'use strict'
const { isMainThread } = require('worker_threads')
const { ThreadWorker } = require('../../../lib/index')
const { jsonIntegerSerialization } = require('../benchmark-utils')

const debug = false

function yourFunction (data) {
  jsonIntegerSerialization(1000)
  debug === true && console.debug('This is the main thread ' + isMainThread)
  return { ok: 1 }
}

module.exports = new ThreadWorker(yourFunction)
