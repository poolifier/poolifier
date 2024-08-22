import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import express, { type Express, type Request, type Response } from 'express'
import {
  availableParallelism,
  ClusterWorker,
  DynamicThreadPool,
} from 'poolifier'

import type {
  ClusterWorkerData,
  ClusterWorkerResponse,
  DataPayload,
  ThreadWorkerData,
  ThreadWorkerResponse,
} from './types.js'

const emptyFunction = (): void => {
  /* Intentional */
}

class ExpressWorker extends ClusterWorker<
  ClusterWorkerData,
  ClusterWorkerResponse
> {
  private static requestHandlerPool: DynamicThreadPool<
    ThreadWorkerData<DataPayload>,
    ThreadWorkerResponse<DataPayload>
  >

  private static server: Server

  private static readonly startExpress = (
    workerData?: ClusterWorkerData
  ): ClusterWorkerResponse => {
    const { maxWorkers, minWorkers, port, workerFile, ...poolOptions } =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      workerData!

    ExpressWorker.requestHandlerPool = new DynamicThreadPool<
      ThreadWorkerData<DataPayload>,
      ThreadWorkerResponse<DataPayload>
    >(
      minWorkers ?? 1,
      maxWorkers ?? availableParallelism(),
      workerFile,
      poolOptions
    )

    const application: Express = express()

    // Parse only JSON requests body
    application.use(express.json())

    application.all('/api/echo', (req: Request, res: Response) => {
      ExpressWorker.requestHandlerPool
        .execute({ data: req.body }, 'echo')
        .then(response => {
          return res.send(response.data).end()
        })
        .catch(emptyFunction)
    })

    application.get('/api/factorial/:number', (req: Request, res: Response) => {
      const { number } = req.params
      ExpressWorker.requestHandlerPool
        .execute({ data: { number: Number.parseInt(number) } }, 'factorial')
        .then(response => {
          return res.send(response.data).end()
        })
        .catch(emptyFunction)
    })

    let listenerPort: number | undefined
    ExpressWorker.server = application.listen(port, () => {
      listenerPort = (ExpressWorker.server.address() as AddressInfo).port
      console.info(
        `⚡️[express server]: Express server is started in cluster worker at http://localhost:${listenerPort.toString()}/`
      )
    })
    return {
      port: listenerPort ?? port,
      status: true,
    }
  }

  public constructor () {
    super(ExpressWorker.startExpress, {
      killHandler: async () => {
        await ExpressWorker.requestHandlerPool.destroy()
        ExpressWorker.server.close()
      },
    })
  }
}

export const expressWorker = new ExpressWorker()
