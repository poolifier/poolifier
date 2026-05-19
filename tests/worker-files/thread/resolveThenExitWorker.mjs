import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/**
 * Returns synchronously, then exits 0 once the response has drained.
 * @returns Static result object.
 */
function resolveThenExit () {
  setTimeout(() => {
    // eslint-disable-next-line n/no-process-exit
    process.exit(0)
  }, 200)
  return { ok: true }
}

export default new ThreadWorker(resolveThenExit, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
