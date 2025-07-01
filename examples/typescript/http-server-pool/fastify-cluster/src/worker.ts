import type { AddressInfo } from 'node:net'

import Fastify, { type FastifyInstance } from 'fastify'
import { ClusterWorker } from 'poolifier'

import type { WorkerData, WorkerResponse } from './types.js'

class FastifyWorker extends ClusterWorker<WorkerData, WorkerResponse> {
  private static fastify: FastifyInstance

  public constructor () {
    super(FastifyWorker.startFastify, {
      killHandler: async () => {
        await FastifyWorker.fastify.close()
      },
    })
  }

  private static readonly factorial = (n: bigint | number): bigint => {
    if (n === 0 || n === 1) {
      return 1n
    }
    n = BigInt(n)
    let factorial = 1n
    for (let i = 1n; i <= n; i++) {
      factorial *= i
    }
    return factorial
  }

  private static readonly startFastify = async (
    workerData?: WorkerData
  ): Promise<WorkerResponse> => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { port } = workerData!

    FastifyWorker.fastify = Fastify({
      logger: true,
    })

    FastifyWorker.fastify.all('/api/echo', request => {
      return request.body
    })

    FastifyWorker.fastify.get<{
      Params: { number: number }
    }>('/api/factorial/:number', request => {
      const { number } = request.params
      return { number: FastifyWorker.factorial(number).toString() }
    })

    await FastifyWorker.fastify.listen({ port })
    return {
      port: (FastifyWorker.fastify.server.address() as AddressInfo).port,
      status: true,
    }
  }
}

export const fastifyWorker = new FastifyWorker()
