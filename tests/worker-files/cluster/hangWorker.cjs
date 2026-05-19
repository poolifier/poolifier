'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

// Hangs forever — keeps the dispatched task in-flight for SIGKILL and
// pool.destroy(tasksFinishedTimeout) regression tests.
/** Hangs forever — keeps the dispatched task in-flight. */
async function hang () {
  await new Promise(() => {})
}

module.exports = new ClusterWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
