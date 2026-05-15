'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/*
 * Cluster worker that hangs forever once a task is dispatched. Used by
 * the in-flight rejection regression tests:
 *   * SIGKILL from parent (cluster signal kill)
 *   * pool.destroy() with tasksFinishedTimeout
 * The hang guarantees the task stays in-flight long enough to exercise
 * the rejection path.
 */

/**
 * Hangs forever; never resolves.
 * @returns Never returns.
 */
async function hang () {
  await new Promise(() => {
    // Never resolve.
  })
}

module.exports = new ClusterWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
