import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { availableParallelism, FixedClusterPool } from 'poolifier'

import type { ClusterWorkerData, ClusterWorkerResponse } from './types.js'

const expressWorkerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `express-worker${extname(fileURLToPath(import.meta.url))}`
)

const requestHandlerWorkerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `request-handler-worker${extname(fileURLToPath(import.meta.url))}`
)

const pool = new FixedClusterPool<ClusterWorkerData, ClusterWorkerResponse>(
  availableParallelism(),
  expressWorkerFile,
  {
    enableEvents: false,
    errorHandler: (e: Error) => {
      console.error('Cluster worker error:', e)
    },
    onlineHandler: () => {
      pool
        .execute({
          enableTasksQueue: true,
          errorHandler: (e: Error) => {
            console.error('Thread worker error:', e)
          },
          maxWorkers:
            Math.round(availableParallelism() / 4) < 1
              ? 1
              : Math.round(availableParallelism() / 4),
          port: 8080,
          tasksQueueOptions: {
            concurrency: 8,
          },
          workerFile: requestHandlerWorkerFile,
        })
        .then(response => {
          if (response.status) {
            console.info(
              `Express is listening in cluster worker on port ${response.port?.toString()}`
            )
          }
          return undefined
        })
        .catch((error: unknown) => {
          console.error('Express failed to start in cluster worker:', error)
        })
    },
  }
)
