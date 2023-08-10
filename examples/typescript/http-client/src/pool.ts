import { fileURLToPath } from 'node:url'
import { dirname, extname, join } from 'node:path'
import { FixedThreadPool, availableParallelism } from 'poolifier'
import { type WorkerData, type WorkerResponse } from './types.js'

const workerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `worker${extname(fileURLToPath(import.meta.url))}`
)

export const fetchPool = new FixedThreadPool<WorkerData, WorkerResponse>(
  availableParallelism(),
  workerFile,
  {
    enableTasksQueue: true,
    errorHandler: (e: Error) => {
      console.error(e)
    }
  }
)
