import { join } from 'path'
import type { MyData, MyResponse } from './worker'
import { DynamicThreadPool, FixedThreadPool } from 'poolifier'

export const fixedPool = new FixedThreadPool<MyData, Promise<MyResponse>>(
  8,
  join(__dirname, 'worker.js'),
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
  2,
  8,
  join(__dirname, 'worker.js'),
  {
    errorHandler: (e: Error) => {
      console.error(e)
    },
    onlineHandler: () => {
      console.info('Worker is online')
    }
  }
)
