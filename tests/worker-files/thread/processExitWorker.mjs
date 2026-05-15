import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/**
 * Test worker that calls process.exit(N) mid-task while the handler hangs.
 * The hang ensures the task is in-flight when the exit fires, exercising
 * the exit-handler crash detection for thread workers (F2 fix).
 */
async function processExit () {
  setTimeout(() => {
    // eslint-disable-next-line n/no-process-exit
    process.exit(2)
  }, 50)
  await new Promise(() => {
    // Never resolve — keep the task in-flight when process.exit fires.
  })
}

export default new ThreadWorker(processExit, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
