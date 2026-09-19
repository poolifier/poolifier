import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

// T3a: timer throws AFTER 'ready' IPC; handler hangs so the task is
// still in-flight when the throw kills the thread.
setTimeout(() => {
  throw new Error('post-online crash')
}, 200)

/** Hangs forever — keeps the dispatched task in-flight at crash time. */
async function hang () {
  await new Promise(() => {})
}

export default new ThreadWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
