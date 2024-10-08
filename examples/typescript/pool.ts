import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  availableParallelism,
  DynamicThreadPool,
  FixedThreadPool,
} from 'poolifier'

import type { MyData, MyResponse } from './worker.js'

const workerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `worker${extname(fileURLToPath(import.meta.url))}`
)

const fixedPool = new FixedThreadPool<MyData, MyResponse>(
  availableParallelism(),
  workerFile,
  {
    errorHandler: (e: Error) => {
      console.error(e)
    },
    onlineHandler: () => {
      console.info('Worker is online')
    },
  }
)

await fixedPool.execute()

const dynamicPool = new DynamicThreadPool<MyData, MyResponse>(
  Math.floor(availableParallelism() / 2),
  availableParallelism(),
  workerFile,
  {
    errorHandler: (e: Error) => {
      console.error(e)
    },
    onlineHandler: () => {
      console.info('Worker is online')
    },
  }
)

await dynamicPool.execute()

// eslint-disable-next-line @typescript-eslint/no-misused-promises
setTimeout(async () => {
  await fixedPool.destroy()
  await dynamicPool.destroy()
}, 3000)
