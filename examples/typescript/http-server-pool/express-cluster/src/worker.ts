import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { ClusterWorker } from 'poolifier'
import express, { type Express, type Request, type Response } from 'express'
import type { WorkerData, WorkerResponse } from './types.js'

class ExpressWorker extends ClusterWorker<WorkerData, WorkerResponse> {
  private static server: Server

  private static readonly factorial = (n: number): number => {
    if (n === 0) {
      return 1
    }
    return ExpressWorker.factorial(n - 1) * n
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
      res.send({ number: ExpressWorker.factorial(parseInt(number)) }).end()
    })

    ExpressWorker.server = application.listen(port, () => {
      console.info(
        `⚡️[express server]: Express server is started in cluster worker at http://localhost:${port}/`
      )
    })
    return {
      status: true,
      port: (ExpressWorker.server.address() as AddressInfo).port
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
