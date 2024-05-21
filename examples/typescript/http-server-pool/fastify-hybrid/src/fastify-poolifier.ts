import type { TransferListItem } from 'node:worker_threads'

import type { FastifyPluginCallback } from 'fastify'
import fp from 'fastify-plugin'
import { availableParallelism, DynamicThreadPool } from 'poolifier'

import type {
  FastifyPoolifierOptions,
  ThreadWorkerData,
  ThreadWorkerResponse
} from './types.js'

const fastifyPoolifierPlugin: FastifyPluginCallback<FastifyPoolifierOptions> = (
  fastify,
  options,
  done
) => {
  options = {
    ...{
      minWorkers: 1,
      maxWorkers: availableParallelism()
    },
    ...options
  }
  const { workerFile, minWorkers, maxWorkers, ...poolOptions } = options
  const pool = new DynamicThreadPool<ThreadWorkerData, ThreadWorkerResponse>(
    minWorkers!,
    maxWorkers!,
    workerFile,
    poolOptions
  )
  if (!fastify.hasDecorator('pool')) {
    fastify.decorate('pool', pool)
  }
  if (!fastify.hasDecorator('execute')) {
    fastify.decorate(
      'execute',
      async (
        data?: ThreadWorkerData,
        name?: string,
        transferList?: readonly TransferListItem[]
      ): Promise<ThreadWorkerResponse> =>
        await pool.execute(data, name, transferList)
    )
  }
  done()
}

export const fastifyPoolifier = fp(fastifyPoolifierPlugin, {
  fastify: '4.x',
  name: 'fastify-poolifier'
})
