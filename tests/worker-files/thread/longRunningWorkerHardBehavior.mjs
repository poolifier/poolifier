import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'
import { sleepTaskFunction } from '../../test-utils.cjs'

/**
 * Test worker function for long-running tasks with hard kill behavior.
 * @param data - The task data
 * @returns The result after sleeping
 */
async function sleep (data) {
  return sleepTaskFunction(data, 50000)
}

export default new ThreadWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
