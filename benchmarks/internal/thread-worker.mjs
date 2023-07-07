import { isMainThread } from 'worker_threads'
import { ThreadWorker } from '../../lib/index.mjs'
import { executeWorkerFunction } from '../benchmarks-utils.mjs'
import { WorkerFunctions } from '../benchmarks-types.mjs'

const debug = false

function workerFunction (data) {
  data = data || {}
  data.function = data.function || WorkerFunctions.jsonIntegerSerialization
  const res = executeWorkerFunction(data)
  debug === true && console.debug('This is the main thread ' + isMainThread)
  return res
}

export default new ThreadWorker(workerFunction)
