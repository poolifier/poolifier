import { DynamicThreadPool } from 'poolifier'
import { type FastifyPluginCallback } from 'fastify'
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
): void => {
  const pool = new DynamicThreadPool<WorkerData, WorkerResponse>(
    options.minWorkers,
    options.maxWorkers,
    options.workerFile,
    options
  )
  if (!fastify.hasDecorator('pool')) {
    fastify.decorate('pool', pool)
  }
  if (!fastify.hasDecorator('execute')) {
    fastify.decorate(
      'execute',
      async (data?: WorkerData, name?: string): Promise<WorkerResponse> =>
        await pool.execute(data, name)
    )
  }
  done()
}

export const fastifyPoolifier = fp(fastifyPoolifierPlugin, {
  fastify: '4.x',
  name: 'fastify-poolifier'
})
