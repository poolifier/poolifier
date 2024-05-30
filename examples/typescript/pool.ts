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
    onlineHandler: () => {
      console.info('Worker is online')
    },
    errorHandler: (e: Error) => {
      console.error(e)
    },
  }
)

await fixedPool.execute()

const dynamicPool = new DynamicThreadPool<MyData, MyResponse>(
  Math.floor(availableParallelism() / 2),
  availableParallelism(),
  workerFile,
  {
    onlineHandler: () => {
      console.info('Worker is online')
    },
    errorHandler: (e: Error) => {
      console.error(e)
    },
  }
)

await dynamicPool.execute()

setTimeout(async () => {
  await fixedPool.destroy()
  await dynamicPool.destroy()
}, 3000)
