import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'
import { sleepTaskFunction } from '../../test-utils.cjs'

/**
 * Test worker function that sleeps for a specified duration.
 * @param data - The task data
 * @returns The result after sleeping
 */
async function sleep (data) {
  return sleepTaskFunction(data, 2000)
}

export default new ThreadWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
