import type { TransferListItem } from 'node:worker_threads'

import type * as fastify from 'fastify'
import type { DynamicThreadPool } from 'poolifier'

import type { WorkerData, WorkerResponse } from '../../src/types.ts'

declare module 'fastify' {
  export interface FastifyInstance extends fastify.FastifyInstance {
    pool: DynamicThreadPool<WorkerData, WorkerResponse>
    execute: (
      data?: WorkerData,
      name?: string,
      transferList?: TransferListItem[]
    ) => Promise<WorkerResponse>
  }
}
