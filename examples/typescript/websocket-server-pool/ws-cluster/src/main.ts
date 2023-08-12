import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FixedClusterPool, availableParallelism } from 'poolifier'
import { type WorkerData, type WorkerResponse } from './types.js'

const workerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `worker${extname(fileURLToPath(import.meta.url))}`
)

const pool = new FixedClusterPool<WorkerData, WorkerResponse>(
  availableParallelism(),
  workerFile,
  {
    errorHandler: (e: Error) => {
      console.error(e)
    }
  }
)

// Start one ws server instance per cluster worker in the pool
for (let i = 1; i <= pool.info.maxSize; i++) {
  pool
    .execute({ port: 8080 })
    .then(response => {
      if (response.status) {
        console.info(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `WebSocket server is listening on worker ${i} on port ${response.port}`
        )
      } else {
        console.error(
          `WebSocket server failed to start on worker ${i}:`,
          response.error
        )
      }
      return null
    })
    .catch(error => {
      console.error(error)
    })
}
