import { KillBehaviors, ThreadWorker } from '../../../lib/index.js'

/**
 *
 * @param data
 */
function echo (data) {
  return data
}

export default new ThreadWorker(echo, {
  killBehavior: KillBehaviors.HARD
})
