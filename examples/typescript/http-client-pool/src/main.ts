import { availableParallelism } from 'poolifier'

import { httpClientPool } from './pool.js'
import type { WorkerResponse } from './types.js'

const parallelism = availableParallelism() * 2
const requestUrl = 'http://localhost:8080/'

for (const workerFunction of ['node_fetch', 'fetch', 'axios']) {
  const httpClientPoolPromises = new Set<Promise<WorkerResponse>>()
  for (let i = 0; i < parallelism; i++) {
    httpClientPoolPromises.add(
      httpClientPool.execute({ input: requestUrl }, workerFunction)
    )
  }
  try {
    const now = performance.now()
    const responses = await Promise.all(httpClientPoolPromises)
    const elapsedTime = performance.now() - now
    console.info(
      `Received in ${elapsedTime.toFixed(
        2
      )}ms an array with ${responses.length.toString()} responses from ${parallelism.toString()} parallel requests made with HTTP client pool task function ${workerFunction} on ${requestUrl}:\n`,
      responses
    )
  } catch (error) {
    console.error(error)
  }
}
