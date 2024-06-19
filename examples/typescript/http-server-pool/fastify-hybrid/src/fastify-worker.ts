import type { AddressInfo } from 'node:net'

import Fastify, { type FastifyInstance } from 'fastify'
import { ClusterWorker } from 'poolifier'

import { fastifyPoolifier } from './fastify-poolifier.js'
import type { ClusterWorkerData, ClusterWorkerResponse } from './types.js'

class FastifyWorker extends ClusterWorker<
  ClusterWorkerData,
  ClusterWorkerResponse
> {
  private static fastify: FastifyInstance

  private static readonly startFastify = async (
    workerData?: ClusterWorkerData
  ): Promise<ClusterWorkerResponse> => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { port, ...fastifyPoolifierOptions } = workerData!

    FastifyWorker.fastify = Fastify({
      logger: true,
    })

    await FastifyWorker.fastify.register(
      fastifyPoolifier,
      fastifyPoolifierOptions
    )

    FastifyWorker.fastify.all('/api/echo', async request => {
      return (
        await FastifyWorker.fastify.execute({ data: request.body }, 'echo')
      ).data
    })

    FastifyWorker.fastify.get<{
      Params: { number: number }
    }>('/api/factorial/:number', async request => {
      const { number } = request.params
      return (
        await FastifyWorker.fastify.execute({ data: { number } }, 'factorial')
      ).data
    })

    await FastifyWorker.fastify.listen({ port })
    return {
      status: true,
      port: (FastifyWorker.fastify.server.address() as AddressInfo).port,
    }
  }

  public constructor () {
    super(FastifyWorker.startFastify, {
      killHandler: async () => {
        await FastifyWorker.fastify.pool.destroy()
        await FastifyWorker.fastify.close()
      },
    })
  }
}

export const fastifyWorker = new FastifyWorker()
