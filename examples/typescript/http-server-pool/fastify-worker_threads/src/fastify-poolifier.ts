import type { TransferListItem } from 'node:worker_threads'
import { DynamicThreadPool, availableParallelism } from 'poolifier'
import type { FastifyPluginCallback } from 'fastify'
import fp from 'fastify-plugin'
import {
  type FastifyPoolifierOptions,
  type WorkerData,
  type WorkerResponse
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
  const pool = new DynamicThreadPool<WorkerData, WorkerResponse>(
    minWorkers as number,
    maxWorkers as number,
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
        data?: WorkerData,
        name?: string,
        transferList?: TransferListItem[]
      ): Promise<WorkerResponse> => await pool.execute(data, name, transferList)
    )
  }
  done()
}

export const fastifyPoolifier = fp(fastifyPoolifierPlugin, {
  fastify: '4.x',
  name: 'fastify-poolifier'
})
