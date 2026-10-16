import { ClusterWorker, KillBehaviors } from '../../../lib/index.mjs'

/**
 *
 */
function test () {}

export default new ClusterWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
