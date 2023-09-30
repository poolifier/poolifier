import { KillBehaviors, ThreadWorker } from '../../../lib/index.js'
import { executeTaskFunction } from '../../test-utils.js'
import { TaskFunctions } from '../../test-types.js'

/**
 *
 * @param data
 * @returns
 */
function test (data) {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  return executeTaskFunction(data)
}

export default new ThreadWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
