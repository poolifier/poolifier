'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

// Crash via uncaught exception during task execution; handler hangs
// so the parent observes non-zero exit while the task is in-flight.
/** Schedules an uncaught throw mid-task; handler hangs to keep the task in-flight. */
async function crash () {
  setTimeout(() => {
    throw new Error('Simulated worker crash')
  }, 10)
  await new Promise(() => {})
}

module.exports = new ClusterWorker(crash, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
