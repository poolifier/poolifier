'use strict'
const { isMainThread } = require('worker_threads')
const { ThreadWorker } = require('../../lib')
const { executeWorkerFunction } = require('../benchmarks-utils')
const { WorkerFunctions } = require('../benchmarks-types')

const debug = false

function yourFunction (data) {
  data = data || {}
  data.function = data.function || WorkerFunctions.jsonIntegerSerialization
  executeWorkerFunction(data)
  debug === true && console.debug('This is the main thread ' + isMainThread)
  return { ok: 1 }
}

module.exports = new ThreadWorker(yourFunction)
