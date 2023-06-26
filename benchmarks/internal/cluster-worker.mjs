import { isMaster } from 'cluster'
import { ClusterWorker } from '../../lib/index.mjs'
import { executeWorkerFunction } from '../benchmarks-utils.mjs'
import { WorkerFunctions } from '../benchmarks-types.mjs'

const debug = false

function workerFunction (data) {
  data = data || {}
  data.function = data.function || WorkerFunctions.jsonIntegerSerialization
  executeWorkerFunction(data)
  debug === true && console.debug('This is the main thread ' + isMaster)
  return { ok: 1 }
}

export default new ClusterWorker(workerFunction)
