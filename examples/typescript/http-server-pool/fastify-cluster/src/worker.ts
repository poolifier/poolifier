import type { AddressInfo } from 'node:net'
import { ClusterWorker } from 'poolifier'
import Fastify from 'fastify'
import type { WorkerData, WorkerResponse } from './types.js'

const factorial: (n: number) => number = n => {
  if (n === 0) {
    return 1
  }
  return factorial(n - 1) * n
}

const startFastify = async (
  workerData?: WorkerData
): Promise<WorkerResponse> => {
  const { port } = workerData as WorkerData
  const fastify = Fastify({
    logger: true
  })

  fastify.all('/api/echo', request => {
    return request.body
  })

  fastify.get<{
    Params: { number: number }
  }>('/api/factorial/:number', request => {
    const { number } = request.params
    return { number: factorial(number) }
  })

  await fastify.listen({ port })
  return {
    status: true,
    port: (fastify.server.address() as AddressInfo).port
  }
}

class FastifyWorker extends ClusterWorker<WorkerData, WorkerResponse> {
  public constructor () {
    super(startFastify)
  }
}

export const fastifyWorker = new FastifyWorker()
