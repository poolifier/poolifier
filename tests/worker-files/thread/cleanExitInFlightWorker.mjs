import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/*
 * Test fixture for T-I5 sub-test (c) — clean process.exit(0) DURING
 * an in-flight task. Mirrors processExitWorker.mjs but with exit code 0
 * to exercise the abnormalExit branch that catches `exitCode === 0`
 * combined with a still-dispatched task.
 */
/**
 *
 */
async function hangThenCleanExit () {
  setTimeout(() => {
    // eslint-disable-next-line n/no-process-exit
    process.exit(0)
  }, 50)
  await new Promise(() => {
    // Never resolve — keep the task in-flight when process.exit fires.
  })
}

export default new ThreadWorker(hangThenCleanExit, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
