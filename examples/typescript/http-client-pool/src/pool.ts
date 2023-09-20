import { fileURLToPath } from 'node:url'
import { dirname, extname, join } from 'node:path'
import { DynamicThreadPool, availableParallelism } from 'poolifier'
import type { WorkerData, WorkerResponse } from './types.js'

const workerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `worker${extname(fileURLToPath(import.meta.url))}`
)

export const httpClientPool = new DynamicThreadPool<WorkerData, WorkerResponse>(
  1,
  availableParallelism(),
  workerFile,
  {
    enableTasksQueue: true,
    tasksQueueOptions: {
      concurrency: 8
    },
    errorHandler: (e: Error) => {
      console.error('Thread worker error:', e)
    }
  }
)
