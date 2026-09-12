'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/** Hangs forever — keeps the dispatched task in-flight (used by SIGKILL and pool.destroy regression tests). */
async function hang () {
  await new Promise(() => {})
}

module.exports = new ClusterWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
