import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'
import { TaskFunctions } from '../../test-types.cjs'
import { executeTaskFunction } from '../../test-utils.cjs'

/**
 * Test worker function that executes configurable task functions for testing.
 * @param data - The task data containing function configuration
 * @returns The result of the executed task function
 */
function test (data) {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  return executeTaskFunction(data)
}

export default new ThreadWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
