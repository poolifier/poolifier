'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

// T-I5a: cluster mirror of thread/cleanExitWorker.mjs. Handler returns
// immediately, module timer triggers `process.exit(0)`.
setTimeout(() => {
  // eslint-disable-next-line n/no-process-exit
  process.exit(0)
}, 300)

/** Test handler — returns immediately. */
function noop () {}

module.exports = new ClusterWorker(noop, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
