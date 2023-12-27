import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MyData, MyResponse } from './worker.js'
import {
  DynamicThreadPool,
  FixedThreadPool,
  availableParallelism
} from 'poolifier'

const workerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `worker${extname(fileURLToPath(import.meta.url))}`
)

export const fixedPool = new FixedThreadPool<MyData, Promise<MyResponse>>(
  availableParallelism(),
  workerFile,
  {
    errorHandler: (e: Error) => {
      console.error(e)
    },
    onlineHandler: () => {
      console.info('Worker is online')
    }
  }
)

export const dynamicPool = new DynamicThreadPool<MyData, Promise<MyResponse>>(
  Math.floor(availableParallelism() / 2),
  availableParallelism(),
  workerFile,
  {
    errorHandler: (e: Error) => {
      console.error(e)
    },
    onlineHandler: () => {
      console.info('Worker is online')
    }
  }
)

// eslint-disable-next-line @typescript-eslint/no-misused-promises
setTimeout(async () => {
  await fixedPool.destroy()
  await dynamicPool.destroy()
}, 3000)
