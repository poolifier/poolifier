'use strict'
const { ClusterWorker, KillBehaviors } = require('../../../lib/index.cjs')

/**
 * Worker that simulates a crash via an unhandled exception during task execution.
 * The async function never resolves, keeping the task in-flight while the scheduled
 * throw causes the worker process to exit with a non-zero code, which is detected
 * by the exit handler on the parent.
 */
async function crash() {
  setTimeout(() => {
    throw new Error('Simulated worker crash')
  }, 10)
  await new Promise(() => {})
}

module.exports = new ClusterWorker(crash, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
