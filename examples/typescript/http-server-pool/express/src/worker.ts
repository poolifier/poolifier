import { ThreadWorker } from 'poolifier'
import { type WorkerData, type WorkerResponse } from './types.js'

class RequestHandlerWorker<
  Data extends WorkerData,
  Response extends WorkerResponse
> extends ThreadWorker<Data, Response> {
  public constructor () {
    super({
      echo: (workerData?: Data) => {
        return workerData as unknown as Response
      }
    })
  }
}

export const requestHandlerWorker = new RequestHandlerWorker<
WorkerData,
WorkerResponse
>()
