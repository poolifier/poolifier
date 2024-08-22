import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { availableParallelism, DynamicThreadPool } from 'poolifier'

import type { WorkerData, WorkerResponse } from './types.js'

const workerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `worker${extname(fileURLToPath(import.meta.url))}`
)

export const httpClientPool = new DynamicThreadPool<WorkerData, WorkerResponse>(
  0,
  availableParallelism(),
  workerFile,
  {
    enableTasksQueue: true,
    errorHandler: (e: Error) => {
      console.error('Thread worker error:', e)
    },
    tasksQueueOptions: {
      concurrency: 8,
    },
  }
)
