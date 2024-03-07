import { isMainThread } from 'node:worker_threads'

import { ThreadWorker } from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.cjs'
import { executeTaskFunction } from '../benchmarks-utils.cjs'

const taskFunction = data => {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  data.debug = data.debug || false
  const res = executeTaskFunction(data)
  data.debug === true &&
    console.debug(`This is the main thread ${isMainThread}`)
  return res
}

export default new ThreadWorker(taskFunction)
