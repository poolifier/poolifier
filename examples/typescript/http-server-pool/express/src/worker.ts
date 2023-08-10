import { ThreadWorker } from 'poolifier'
import { type WorkerData, type WorkerResponse } from './types.js'

class RequestHandlerWorker extends ThreadWorker<WorkerData, WorkerResponse> {
  public constructor () {
    super({
      echo: (workerData?: WorkerData) => {
        return workerData as WorkerResponse
      }
    })
  }
}

export const requestHandlerWorker = new RequestHandlerWorker()
