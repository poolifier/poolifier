import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/**
 * Worker that simulates a crash via an unhandled exception during task execution.
 * The async function never resolves, keeping the task in-flight while the scheduled
 * throw kills the worker thread and triggers the 'error' event on the parent.
 */
async function crash() {
  setTimeout(() => {
    throw new Error('Simulated worker crash')
  }, 10)
  await new Promise(() => {})
}

export default new ThreadWorker(crash, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
