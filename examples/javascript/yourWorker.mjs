import { ThreadWorker } from 'poolifier'

/**
 * Example worker function that performs JSON serialization operations.
 * @returns The result indicating successful completion.
 */
function yourFunction () {
  for (let i = 0; i <= 1000; i++) {
    const o = {
      a: i,
    }
    JSON.stringify(o)
  }
  return { ok: 1 }
}

export default new ThreadWorker(yourFunction)
