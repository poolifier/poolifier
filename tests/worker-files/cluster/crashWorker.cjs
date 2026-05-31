'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

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
