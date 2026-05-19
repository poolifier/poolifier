import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

// Hangs forever — keeps the dispatched task in-flight for in-flight
// rejection regression tests.
/** Hangs forever — keeps the dispatched task in-flight. */
async function hang () {
  await new Promise(() => {})
}

export default new ThreadWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
