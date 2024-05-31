import { exit } from 'node:process'

import express, { type Express, type Request, type Response } from 'express'

import { requestHandlerPool } from './pool.js'

/**
 * The goal of this example is to show how to use the poolifier library to create a pool of workers that can handle HTTP requests.
 * The request handler pool can also be used as a middleware in the express stack: application or router level.
 *
 * The express server is still single-threaded, but the request handler pool is multi-threaded.
 */

const port = 8080
const expressApp: Express = express()

const emptyFunction = (): void => {
  /* Intentional */
}

// Parse only JSON requests body
expressApp.use(express.json())

expressApp.all('/api/echo', (req: Request, res: Response) => {
  requestHandlerPool
    .execute({ body: req.body }, 'echo')
    .then(response => {
      return res.send(response.body).end()
    })
    .catch(emptyFunction)
})

expressApp.get('/api/factorial/:number', (req: Request, res: Response) => {
  const { number } = req.params
  requestHandlerPool
    .execute({ body: { number: Number.parseInt(number) } }, 'factorial')
    .then(response => {
      return res.send(response.body).end()
    })
    .catch(emptyFunction)
})

try {
  expressApp.listen(port, () => {
    console.info(
      `⚡️[express server]: Express server is started at http://localhost:${port.toString()}/`
    )
  })
} catch (err) {
  console.error(err)
  exit(1)
}
