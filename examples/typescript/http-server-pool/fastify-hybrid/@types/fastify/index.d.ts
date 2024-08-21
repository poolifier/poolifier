import type * as fastify from 'fastify'
import type { TransferListItem } from 'node:worker_threads'
import type { DynamicThreadPool } from 'poolifier'

import type { ThreadWorkerData, ThreadWorkerResponse } from '../../src/types.ts'

declare module 'fastify' {
  export interface FastifyInstance extends fastify.FastifyInstance {
    execute: (
      data?: ThreadWorkerData,
      name?: string,
      transferList?: readonly TransferListItem[]
    ) => Promise<ThreadWorkerResponse>
    pool: DynamicThreadPool<ThreadWorkerData, ThreadWorkerResponse>
  }
}
