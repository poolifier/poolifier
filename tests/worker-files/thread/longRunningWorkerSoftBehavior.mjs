import { ThreadWorker } from '../../../lib/index.cjs'
import { sleepTaskFunction } from '../../test-utils.cjs'

/**
 *
 * @param data
 * @returns
 */
async function sleep (data) {
  return sleepTaskFunction(data, 50000)
}

export default new ThreadWorker(sleep, {
  maxInactiveTime: 500,
})
