import DynamicThreadPool from './dynamic'
import FixedThreadPool from './fixed'
import { ThreadWorker } from './workers'

export type {
  Draft,
  FixedThreadPoolOptions,
  WorkerWithMessageChannel
} from './fixed'
export type { DynamicThreadPoolOptions } from './dynamic'
export type { ThreadWorkerOptions } from './workers'
export { FixedThreadPool, DynamicThreadPool, ThreadWorker }

module.exports = { FixedThreadPool, DynamicThreadPool, ThreadWorker }
