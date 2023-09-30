import { ThreadWorker } from '../../../lib/index.js'
import { sleepTaskFunction } from '../../test-utils.js'

/**
 *
 * @param data
 */
async function sleep (data) {
  return sleepTaskFunction(data, 50000)
}

export default new ThreadWorker(sleep, {
  maxInactiveTime: 500
})
