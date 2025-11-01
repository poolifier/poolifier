import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'

/**
 * Test worker function that echoes the input data.
 * @param data - The task data to echo
 * @returns The same data that was passed in
 */
function echo (data) {
  return data
}

export default new ThreadWorker(echo, {
  killBehavior: KillBehaviors.HARD,
})
