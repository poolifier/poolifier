import { ClusterWorker, KillBehaviors } from '../../../lib/index.mjs'
import { sleepTaskFunction } from '../../test-utils.cjs'

/**
 * Test worker function that throws an error after sleeping.
 * @param data - The task data.
 * @returns The result after sleeping and potentially throwing an error.
 */
async function error (data) {
  return sleepTaskFunction(
    data,
    2000,
    true,
    'Error Message from ClusterWorker:async'
  )
}

export default new ClusterWorker(error, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
