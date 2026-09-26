import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/** Hangs forever — keeps the dispatched task in-flight (used by SIGKILL and pool.destroy regression tests). */
async function hang () {
  await new Promise(() => {})
}

export default new ThreadWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
