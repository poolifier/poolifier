'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/*
 * Test fixture for T3 (post-online crash) regression coverage —
 * cluster mirror of tests/worker-files/thread/startupCrashWorker.mjs.
 *
 * The module-level setTimeout fires AFTER ClusterWorker has sent its
 * 'ready' IPC. When the timer throws, the unhandled exception causes
 * the worker process to exit non-zero while the dispatched task is
 * still in-flight (handler hangs forever).
 */
setTimeout(() => {
  throw new Error('post-online crash')
}, 200)

/**
 *
 */
async function hang () {
  await new Promise(() => {})
}

module.exports = new ClusterWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
