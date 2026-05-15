import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/**
 * Thread worker that hangs forever once a task is dispatched.
 * Used by in-flight rejection regression tests.
 */
async function hang () {
  await new Promise(() => {
    // Never resolve.
  })
}

export default new ThreadWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
