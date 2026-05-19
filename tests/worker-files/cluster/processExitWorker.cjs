'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/**
 * Cluster mirror of thread/processExitWorker.mjs. Calls process.exit(N)
 * mid-task while the handler hangs, exercising the cluster exit-handler
 * crash detection.
 * @returns Never — the handler hangs forever.
 */
async function processExit () {
  setTimeout(() => {
    // eslint-disable-next-line n/no-process-exit
    process.exit(2)
  }, 50)
  await new Promise(() => undefined)
}

module.exports = new ClusterWorker(processExit, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
