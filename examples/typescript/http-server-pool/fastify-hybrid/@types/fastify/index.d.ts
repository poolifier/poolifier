import type { TransferListItem } from 'node:worker_threads'

import type * as fastify from 'fastify'
import type { DynamicThreadPool } from 'poolifier'

import type { ThreadWorkerData, ThreadWorkerResponse } from '../../src/types.ts'

declare module 'fastify' {
  export interface FastifyInstance extends fastify.FastifyInstance {
    pool: DynamicThreadPool<ThreadWorkerData, ThreadWorkerResponse>
    execute: (
      data?: ThreadWorkerData,
      name?: string,
      transferList?: readonly TransferListItem[]
    ) => Promise<ThreadWorkerResponse>
  }
}
