import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'
import { TaskFunctions } from '../../test-types.cjs'
import { executeTaskFunction } from '../../test-utils.cjs'

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
