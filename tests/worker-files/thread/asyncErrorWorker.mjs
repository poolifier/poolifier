import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'
import { sleepTaskFunction } from '../../test-utils.cjs'

/**
 * Test worker function that generates an asynchronous error for testing error handling.
 * @param data - The task data.
 * @returns Promise that rejects with an error message.
 */
async function error (data) {
  return sleepTaskFunction(
    data,
    2000,
    true,
    'Error Message from ThreadWorker:async'
  )
}

export default new ThreadWorker(error, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
