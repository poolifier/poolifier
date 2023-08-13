import type { AddressInfo } from 'node:net'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ClusterWorker, availableParallelism } from 'poolifier'
import Fastify from 'fastify'
import type { ClusterWorkerData, ClusterWorkerResponse } from './types.js'
import { fastifyPoolifier } from './fastify-poolifier.js'

const startFastify = async (
  workerData?: ClusterWorkerData
): Promise<ClusterWorkerResponse> => {
  const { port } = workerData as ClusterWorkerData
  const fastify = Fastify({
    logger: true
  })

  const requestHandlerWorkerFile = join(
    dirname(fileURLToPath(import.meta.url)),
    `request-handler-worker${extname(fileURLToPath(import.meta.url))}`
  )

  await fastify.register(fastifyPoolifier, {
    workerFile: requestHandlerWorkerFile,
    maxWorkers: Math.round(availableParallelism() / 2),
    enableTasksQueue: true,
    tasksQueueOptions: {
      concurrency: 8
    },
    errorHandler: (e: Error) => {
      fastify.log.error('Thread worker error', e)
    }
  })

  fastify.all('/api/echo', async request => {
    return (await fastify.execute({ body: request.body }, 'echo')).body
  })

  fastify.get<{
    Params: { number: number }
  }>('/api/factorial/:number', async request => {
    const { number } = request.params
    return (await fastify.execute({ body: { number } }, 'factorial')).body
  })

  await fastify.listen({ port })
  return {
    status: true,
    port: (fastify.server.address() as AddressInfo).port
  }
}

class FastifyWorker extends ClusterWorker<
ClusterWorkerData,
ClusterWorkerResponse
> {
  public constructor () {
    super(startFastify)
  }
}

export const fastifyWorker = new FastifyWorker()
