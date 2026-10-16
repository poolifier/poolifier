import { isPrimary } from 'node:cluster'

import { ClusterWorker } from '../../lib/index.mjs'
import { TaskFunctions } from '../benchmarks-types.cjs'
import { executeTaskFunction } from '../benchmarks-utils.mjs'

const taskFunction = data => {
  data = data || {}
  data.function = data.function || TaskFunctions.factorial
  data.debug = data.debug || false
  const res = executeTaskFunction(data)
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  data.debug === true && console.debug(`This is the main thread ${isPrimary}`)
  return res
}

export default new ClusterWorker(taskFunction)
