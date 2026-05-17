import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/*
 * Test fixture for T3 (post-online crash) regression coverage.
 *
 * The module-level setTimeout fires AFTER the ThreadWorker has sent its
 * 'ready' IPC, so the parent pool considers the worker online. When the
 * timer throws, the unhandled exception terminates the worker thread
 * while the dispatched task is still in-flight (handler hangs forever).
 *
 * Without the hang, the handler `async () => ({})` would resolve
 * synchronously and there would be no in-flight task at t=200ms — T3
 * would not exercise the rejection path it is meant to cover.
 */
setTimeout(() => {
  throw new Error('post-online crash')
}, 200)

/**
 *
 */
async function hang () {
  await new Promise(() => {})
}

export default new ThreadWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
