import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

// T-I5c: clean `process.exit(0)` DURING an in-flight task — exercises
// the `exitCode === 0 && hasInFlightTask` abnormalExit branch.
/** Hangs while a deferred `process.exit(0)` fires — exercises clean-exit-with-in-flight-task. */
async function hangThenCleanExit () {
  setTimeout(() => {
    // eslint-disable-next-line n/no-process-exit
    process.exit(0)
  }, 50)
  await new Promise(() => {})
}

export default new ThreadWorker(hangThenCleanExit, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
