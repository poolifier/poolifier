import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { availableParallelism, FixedClusterPool } from 'poolifier'

import type { WorkerData, WorkerResponse } from './types.js'

const workerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `worker${extname(fileURLToPath(import.meta.url))}`
)

const pool = new FixedClusterPool<WorkerData, WorkerResponse>(
  availableParallelism(),
  workerFile,
  {
    enableEvents: false,
    onlineHandler: () => {
      pool
        .execute({ port: 8080 })
        .then(response => {
          if (response.status) {
            console.info(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `Express is listening in cluster worker on port ${response.port?.toString()}`
            )
          }
          return undefined
        })
        .catch((error: unknown) => {
          console.error('Express failed to start in cluster worker:', error)
        })
    },
    errorHandler: (e: Error) => {
      console.error('Cluster worker error:', e)
    },
  }
)
