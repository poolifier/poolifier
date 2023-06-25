import { isMaster } from 'cluster'
import { ClusterWorker } from '../../lib/index.mjs'
import { executeWorkerFunction } from '../benchmarks-utils.js'
import { WorkerFunctions } from '../benchmarks-types.js'

const debug = false

function yourFunction (data) {
  data = data || {}
  data.function = data.function || WorkerFunctions.jsonIntegerSerialization
  executeWorkerFunction(data)
  debug === true && console.debug('This is the main thread ' + isMaster)
  return { ok: 1 }
}

export default new ClusterWorker(yourFunction)
