'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/**
 * Calls process.exit(0) mid-task; handler hangs to keep the task in-flight.
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
