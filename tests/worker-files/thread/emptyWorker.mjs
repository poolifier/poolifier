import { KillBehaviors, ThreadWorker } from '../../../lib/index.js'

/**
 *
 */
function test () {}

export default new ThreadWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500
})
