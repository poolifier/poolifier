import { availableParallelism } from 'poolifier'
import { fetchPool } from './pool.js'
import { type WorkerResponse } from './types.js'

const parallelism = availableParallelism()
const requestUrl = 'http://localhost:8080/'

for (const workerFunction of ['node_fetch', 'fetch']) {
  const fetchPoolPromises = new Set<Promise<WorkerResponse>>()
  for (let i = 0; i < availableParallelism(); i++) {
    fetchPoolPromises.add(
      fetchPool.execute({ url: requestUrl }, workerFunction)
    )
  }
  try {
    const now = performance.now()
    const responses = await Promise.all(fetchPoolPromises)
    const elapsedTime = performance.now() - now
    console.info(
      `Received in ${elapsedTime.toFixed(2)}ms an array with ${
        responses.length
      } responses from ${parallelism} parallel requests made with ${workerFunction} on ${requestUrl}:\n`,
      responses
    )
  } catch (error) {
    console.error(error)
  }
}
