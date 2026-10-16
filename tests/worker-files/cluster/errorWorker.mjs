import { ClusterWorker, KillBehaviors } from '../../../lib/index.mjs'

/**
 *
 */
function error () {
  throw new Error('Error Message from ClusterWorker')
}

export default new ClusterWorker(error, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
