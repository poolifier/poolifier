import { KillBehaviors, ThreadWorker } from '../../../lib/index.js'
import { sleepTaskFunction } from '../../test-utils.js'

/**
 *
 * @param data
 * @returns
 */
async function sleep (data) {
  return sleepTaskFunction(data, 50000)
}

export default new ThreadWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
