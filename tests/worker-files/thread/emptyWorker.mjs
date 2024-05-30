import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'

/**
 *
 */
function test () {}

export default new ThreadWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
