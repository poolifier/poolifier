import { isPrimary } from 'node:cluster'
import { ClusterWorker } from '../../lib/index.mjs'
import { executeTaskFunction } from '../benchmarks-utils.mjs'
import { TaskFunctions } from '../benchmarks-types.mjs'

const taskFunction = data => {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  data.debug = data.debug || false
  const res = executeTaskFunction(data)
  data.debug === true && console.debug(`This is the main thread ${isPrimary}`)
  return res
}

export default new ClusterWorker(taskFunction)
