'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/*
 * Test fixture for T-I5 sub-test (a) — cluster mirror of
 * tests/worker-files/thread/cleanExitWorker.mjs.
 *
 * The handler returns immediately; the module-level setTimeout
 * triggers `process.exit(0)` after a short delay so the pool's
 * exit handler observes a clean exit (exitCode === 0).
 */
setTimeout(() => {
  // eslint-disable-next-line n/no-process-exit
  process.exit(0)
}, 300)

/**
 *
 */
function noop () {
  // No-op handler — see fixture rationale above.
}

module.exports = new ClusterWorker(noop, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
