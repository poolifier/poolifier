import { join } from 'path'
import { DynamicThreadPool, FixedThreadPool } from 'poolifier'
import { MyData, MyResponse } from './worker'

export const fixedPool = new FixedThreadPool<MyData, Promise<MyResponse>>(
  8,
  join(__dirname, 'worker.js'),
  {
    errorHandler: e => console.error(e),
    onlineHandler: () => console.log('Worker is online')
  }
)

export const dynamicPool = new DynamicThreadPool<MyData, Promise<MyResponse>>(
  2,
  8,
  join(__dirname, 'worker.js'),
  {
    errorHandler: e => console.error(e),
    onlineHandler: () => console.log('Worker is online')
  }
)
