import { fileURLToPath } from 'node:url'
import { dirname, extname, join } from 'node:path'
import { DynamicThreadPool, availableParallelism } from 'poolifier'
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'
import type { WorkerData } from './types.js'

const workerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `worker${extname(fileURLToPath(import.meta.url))}`
)

export const smtpClientPool = new DynamicThreadPool<
WorkerData,
SMTPTransport.SentMessageInfo
>(0, availableParallelism(), workerFile, {
  enableTasksQueue: true,
  tasksQueueOptions: {
    concurrency: 8
  },
  errorHandler: (e: Error) => {
    console.error('Thread worker error:', e)
  }
})
