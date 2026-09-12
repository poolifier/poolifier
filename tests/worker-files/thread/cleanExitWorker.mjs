import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

// T-I5a: handler returns immediately, module timer triggers
// `process.exit(0)` for clean-exit replenishment.
setTimeout(() => {
  // eslint-disable-next-line n/no-process-exit
  process.exit(0)
}, 300)

/** Test handler — returns immediately. */
function noop () {}

export default new ThreadWorker(noop, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 60_000,
})
