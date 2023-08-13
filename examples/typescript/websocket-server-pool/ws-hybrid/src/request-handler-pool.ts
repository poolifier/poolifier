import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DynamicThreadPool, availableParallelism } from 'poolifier'
import {
  type DataPayload,
  type ThreadWorkerData,
  type ThreadWorkerResponse
} from './types.js'

const requestHandlerWorkerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `request-handler-worker${extname(fileURLToPath(import.meta.url))}`
)

export const requestHandlerPool = new DynamicThreadPool<
ThreadWorkerData<DataPayload>,
ThreadWorkerResponse<DataPayload>
>(1, Math.round(availableParallelism() / 2), requestHandlerWorkerFile, {
  enableTasksQueue: true,
  tasksQueueOptions: {
    concurrency: 8
  },
  errorHandler: (e: Error) => {
    console.error('Thread worker error:', e)
  }
})
