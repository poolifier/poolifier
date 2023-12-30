import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  ClusterWorker,
  DynamicThreadPool,
  availableParallelism
} from 'poolifier'
import express, { type Express, type Request, type Response } from 'express'
import {
  type ClusterWorkerData,
  type ClusterWorkerResponse,
  type DataPayload,
  type ThreadWorkerData,
  type ThreadWorkerResponse
} from './types.js'

const emptyFunction = (): void => {
  /* Intentional */
}

class ExpressWorker extends ClusterWorker<
ClusterWorkerData,
ClusterWorkerResponse
> {
  private static server: Server
  private static requestHandlerPool: DynamicThreadPool<
  ThreadWorkerData<DataPayload>,
  ThreadWorkerResponse<DataPayload>
  >

  private static readonly startExpress = (
    workerData?: ClusterWorkerData
  ): ClusterWorkerResponse => {
    const { port, workerFile, minWorkers, maxWorkers, ...poolOptions } =
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
        .execute({ data: { number: parseInt(number) } }, 'factorial')
        .then(response => {
          return res.send(response.data).end()
        })
        .catch(emptyFunction)
    })

    ExpressWorker.server = application.listen(port, () => {
      console.info(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `⚡️[express server]: Express server is started in cluster worker at http://localhost:${port}/`
      )
    })
    return {
      status: true,
      port: (ExpressWorker.server.address() as AddressInfo)?.port ?? port
    }
  }

  public constructor () {
    super(ExpressWorker.startExpress, {
      killHandler: async () => {
        await ExpressWorker.requestHandlerPool.destroy()
        ExpressWorker.server.close()
      }
    })
  }
}

export const expressWorker = new ExpressWorker()
