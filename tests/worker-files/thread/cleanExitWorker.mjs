import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/*
 * Test fixture for T-I5 sub-test (a) — clean exit replenishment.
 *
 * The worker handler returns immediately so the dispatched task
 * resolves cleanly. After a short idle delay the module-level
 * setTimeout calls `process.exit(0)`. The pool's exit handler
 * receives `exitCode === 0`, `signal === null`, which is NOT an
 * abnormal exit. The replenishment predicate
 * `(code === 0 || restartWorkerOnError === true)` selects the
 * `code === 0` branch — pool replenishes even with
 * `restartWorkerOnError: false`.
 */
setTimeout(() => {
  // eslint-disable-next-line n/no-process-exit
  process.exit(0)
}, 300)

/**
 *
 */
function noop() {
  // No-op handler — see fixture rationale above.
}

export default new ThreadWorker(noop, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
