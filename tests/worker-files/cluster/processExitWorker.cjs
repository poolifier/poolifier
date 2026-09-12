'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/**
 * Calls process.exit(N) mid-task; handler hangs to keep the task in-flight.
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
