import type { FastifyPluginCallback } from 'fastify'
import type { Transferable } from 'node:worker_threads'

import fp from 'fastify-plugin'
import { availableParallelism, DynamicThreadPool } from 'poolifier'

import type {
  FastifyPoolifierOptions,
  ThreadWorkerData,
  ThreadWorkerResponse,
} from './types.js'

const fastifyPoolifierPlugin: FastifyPluginCallback<FastifyPoolifierOptions> = (
  fastify,
  options,
  done
) => {
  options = {
    ...{
      maxWorkers: availableParallelism(),
      minWorkers: 1,
    },
    ...options,
  }
  const { maxWorkers, minWorkers, workerFile, ...poolOptions } = options
  const pool = new DynamicThreadPool<ThreadWorkerData, ThreadWorkerResponse>(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    minWorkers!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        transferList?: readonly Transferable[],
        abortSignal?: AbortSignal
      ): Promise<ThreadWorkerResponse> =>
        await pool.execute(data, name, transferList, abortSignal)
    )
  }
  if (!fastify.hasDecorator('mapExecute')) {
    fastify.decorate(
      'mapExecute',
      async (
        data: Iterable<ThreadWorkerData>,
        name?: string,
        transferList?: readonly Transferable[],
        abortSignal?: AbortSignal
      ): Promise<ThreadWorkerResponse[]> =>
        await pool.mapExecute(data, name, transferList, abortSignal)
    )
  }
  done()
}

export const fastifyPoolifier = fp(fastifyPoolifierPlugin, {
  fastify: '5.x',
  name: 'fastify-poolifier',
})
