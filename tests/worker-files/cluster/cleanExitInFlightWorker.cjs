'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/**
 * Cluster mirror of thread/cleanExitInFlightWorker.mjs. Hangs while a
 * deferred process.exit(0) fires — exercises the
 * `exitCode === 0 && hasInFlightTask` abnormalExit branch for cluster.
 * @returns Never — the handler hangs forever.
 */
async function hangThenCleanExit () {
  setTimeout(() => {
    // eslint-disable-next-line n/no-process-exit
    process.exit(0)
  }, 50)
  await new Promise(() => undefined)
}

module.exports = new ClusterWorker(hangThenCleanExit, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
