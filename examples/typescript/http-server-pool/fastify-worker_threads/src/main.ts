import Fastify from 'fastify'
import { dirname, extname, join } from 'node:path'
import { exit } from 'node:process'
import { fileURLToPath } from 'node:url'

import { fastifyPoolifier } from './fastify-poolifier.js'

/**
 * The fastify server is still a single-threaded application, but the request handling can be multi-threaded.
 */

const port = 8080
const fastify = Fastify({
  logger: true,
})

const workerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `worker${extname(fileURLToPath(import.meta.url))}`
)

await fastify.register(fastifyPoolifier, {
  enableTasksQueue: true,
  errorHandler: (e: Error) => {
    fastify.log.error('Thread worker error:', e)
  },
  tasksQueueOptions: {
    concurrency: 8,
  },
  workerFile,
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

try {
  await fastify.listen({ port })
} catch (err) {
  fastify.log.error(err)
  exit(1)
}
