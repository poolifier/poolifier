import type * as fastify from 'fastify'
import type { TransferListItem } from 'node:worker_threads'
import type { DynamicThreadPool } from 'poolifier'

import type { WorkerData, WorkerResponse } from '../../src/types.ts'

declare module 'fastify' {
  export interface FastifyInstance extends fastify.FastifyInstance {
    execute: (
      data?: WorkerData,
      name?: string,
      transferList?: readonly TransferListItem[]
    ) => Promise<WorkerResponse>
    pool: DynamicThreadPool<WorkerData, WorkerResponse>
  }
}
