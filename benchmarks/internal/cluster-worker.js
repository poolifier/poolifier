const { isPrimary } = require('node:cluster')
const { ClusterWorker } = require('../../lib')
const { executeTaskFunction } = require('../benchmarks-utils.js')
const { TaskFunctions } = require('../benchmarks-types.js')

const taskFunction = data => {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  data.debug = data.debug || false
  const res = executeTaskFunction(data)
  data.debug === true && console.debug(`This is the main thread ${isPrimary}`)
  return res
}

module.exports = new ClusterWorker(taskFunction)
