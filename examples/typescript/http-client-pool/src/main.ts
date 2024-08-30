import { availableParallelism } from 'poolifier'

import type { WorkerData } from './types.js'

import { httpClientPool } from './pool.js'

const parallelism = availableParallelism() * 2
const requestUrl = 'http://localhost:8080/'

for (const workerFunction of ['node_fetch', 'fetch', 'axios']) {
  const httpClientRequests = new Set<WorkerData>()
  for (let i = 0; i < parallelism; i++) {
    httpClientRequests.add({ input: requestUrl })
  }
  try {
    const now = performance.now()
    const responses = await httpClientPool.mapExecute(
      httpClientRequests,
      workerFunction
    )
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
