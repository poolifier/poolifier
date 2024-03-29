const { isPrimary } = require('node:cluster')
const { ClusterWorker } = require('../../lib/index.cjs')
const { executeTaskFunction } = require('../benchmarks-utils.cjs')
const { TaskFunctions } = require('../benchmarks-types.cjs')

const taskFunction = data => {
  data = data || {}
  data.function = data.function || TaskFunctions.factorial
  data.debug = data.debug || false
  const res = executeTaskFunction(data)
  data.debug === true && console.debug(`This is the main thread ${isPrimary}`)
  return res
}

module.exports = new ClusterWorker(taskFunction)
