import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type { MyData, MyResponse } from './worker'
import {
  DynamicThreadPool,
  FixedThreadPool,
  availableParallelism
} from 'poolifier'

export const fixedPool = new FixedThreadPool<MyData, Promise<MyResponse>>(
  availableParallelism(),
  join(dirname(fileURLToPath(import.meta.url)), 'worker.js'),
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
  join(dirname(fileURLToPath(import.meta.url)), 'worker.js'),
  {
    errorHandler: (e: Error) => {
      console.error(e)
    },
    onlineHandler: () => {
      console.info('Worker is online')
    }
  }
)
