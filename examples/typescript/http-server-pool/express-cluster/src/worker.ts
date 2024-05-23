import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express, { type Express, type Request, type Response } from 'express'
import { ClusterWorker } from 'poolifier'

import type { WorkerData, WorkerResponse } from './types.js'

class ExpressWorker extends ClusterWorker<WorkerData, WorkerResponse> {
  private static server: Server

  private static readonly factorial = (n: number | bigint): bigint => {
    if (n === 0 || n === 1) {
      return 1n
    } else {
      n = BigInt(n)
      let factorial = 1n
      for (let i = 1n; i <= n; i++) {
        factorial *= i
      }
      return factorial
    }
  }

  private static readonly startExpress = (
    workerData?: WorkerData
  ): WorkerResponse => {
    const { port } = workerData!

    const application: Express = express()

    // Parse only JSON requests body
    application.use(express.json())

    application.all('/api/echo', (req: Request, res: Response) => {
      res.send(req.body).end()
    })

    application.get('/api/factorial/:number', (req: Request, res: Response) => {
      const { number } = req.params
      res
        .send({
          number: ExpressWorker.factorial(Number.parseInt(number)).toString()
        })
        .end()
    })

    let listenerPort: number | undefined
    ExpressWorker.server = application.listen(port, () => {
      listenerPort = (ExpressWorker.server.address() as AddressInfo).port
      console.info(
        `⚡️[express server]: Express server is started in cluster worker at http://localhost:${listenerPort}/`
      )
    })
    return {
      status: true,
      port: listenerPort ?? port
    }
  }

  public constructor () {
    super(ExpressWorker.startExpress, {
      killHandler: () => {
        ExpressWorker.server.close()
      }
    })
  }
}

export const expressWorker = new ExpressWorker()
