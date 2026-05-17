import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/*
 * Test fixture for T3 (post-online crash) regression coverage.
 *
 * The module-level setTimeout fires AFTER the ThreadWorker has sent its
 * 'ready' IPC, so the parent pool considers the worker online. When the
 * timer throws, the unhandled exception terminates the worker thread
 * while the dispatched task is still in-flight (handler hangs forever).
 *
 * Without the hang, the dispatched task would settle on a microtask
 * before the t=200ms timer throws — leaving no in-flight entry to
 * exercise T3's rejection path.
 */
setTimeout(() => {
  throw new Error('post-online crash')
}, 200)

/**
 * Test handler — never settles, keeps the dispatched task in flight.
 */
async function hang () {
  await new Promise(() => {})
}

export default new ThreadWorker(hang, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
