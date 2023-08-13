import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FixedClusterPool, availableParallelism } from 'poolifier'
import type { ClusterWorkerData, ClusterWorkerResponse } from './types.js'

const fastifyWorkerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `fastify-worker${extname(fileURLToPath(import.meta.url))}`
)

const pool = new FixedClusterPool<ClusterWorkerData, ClusterWorkerResponse>(
  Math.round(availableParallelism() / 2),
  fastifyWorkerFile,
  {
    onlineHandler: () => {
      pool
        .execute({ port: 8080 })
        .then(response => {
          if (response.status) {
            console.info(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `Fastify is listening on worker on port ${response.port}`
            )
          }
          return null
        })
        .catch(error => {
          console.error('Fastify failed to start on worker:', error)
        })
    },
    errorHandler: (e: Error) => {
      console.error('Cluster worker error:', e)
    }
  }
)
