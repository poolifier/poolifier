'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

// T3b: cluster mirror of thread/startupCrashWorker.mjs. Timer throws
// AFTER 'ready' IPC; handler hangs to keep the task in-flight.
setTimeout(() => {
  throw new Error('post-online crash')
}, 200)

/** Hangs forever — keeps the dispatched task in-flight at crash time. */
async function hang () {
  await new Promise(() => {})
}

module.exports = new ClusterWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
