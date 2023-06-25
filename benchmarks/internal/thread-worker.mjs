import { isMainThread } from 'worker_threads'
import { ThreadWorker } from '../../lib/index.mjs'
import { executeWorkerFunction } from '../benchmarks-utils.mjs'
import { WorkerFunctions } from '../benchmarks-types.mjs'

const debug = false

function yourFunction (data) {
  data = data || {}
  data.function = data.function || WorkerFunctions.jsonIntegerSerialization
  executeWorkerFunction(data)
  debug === true && console.debug('This is the main thread ' + isMainThread)
  return { ok: 1 }
}

export default new ThreadWorker(yourFunction)
