import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

/** Schedules an uncaught throw mid-task; handler hangs to keep the task in-flight. */
async function crash () {
  setTimeout(() => {
    throw new Error('Simulated worker crash')
  }, 10)
  await new Promise(() => {})
}

export default new ThreadWorker(crash, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
