import type { AddressInfo } from 'node:net'

import Fastify, { type FastifyInstance } from 'fastify'
import { ClusterWorker } from 'poolifier'

import type { WorkerData, WorkerResponse } from './types.js'

class FastifyWorker extends ClusterWorker<WorkerData, WorkerResponse> {
  private static fastify: FastifyInstance

  private static readonly factorial = (n: number): number => {
    if (n === 0) {
      return 1
    }
    return FastifyWorker.factorial(n - 1) * n
  }

  private static readonly startFastify = async (
    workerData?: WorkerData
  ): Promise<WorkerResponse> => {
    const { port } = workerData!

    FastifyWorker.fastify = Fastify({
      logger: true
    })

    FastifyWorker.fastify.all('/api/echo', request => {
      return request.body
    })

    FastifyWorker.fastify.get<{
      Params: { number: number }
    }>('/api/factorial/:number', request => {
      const { number } = request.params
      return { number: FastifyWorker.factorial(number) }
    })

    await FastifyWorker.fastify.listen({ port })
    return {
      status: true,
      port: (FastifyWorker.fastify.server.address() as AddressInfo).port
    }
  }

  public constructor () {
    super(FastifyWorker.startFastify, {
      killHandler: async () => {
        await FastifyWorker.fastify.close()
      }
    })
  }
}

export const fastifyWorker = new FastifyWorker()
