import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'

/**
 *
 * @param data
 * @returns
 */
function echo (data) {
  return data
}

export default new ThreadWorker(echo, {
  killBehavior: KillBehaviors.HARD,
})
