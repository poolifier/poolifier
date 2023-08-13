import { ThreadWorker } from 'poolifier'
import {
  type DataPayload,
  type WorkerData,
  type WorkerResponse
} from './types.js'

const factorial: (n: number) => number = (n) => {
  if (n === 0) {
    return 1
  }
  return factorial(n - 1) * n
}

class RequestHandlerWorker<
  Data extends WorkerData<DataPayload>,
  Response extends WorkerResponse<DataPayload>
> extends ThreadWorker<Data, Response> {
  public constructor () {
    super({
      echo: (workerData?: Data) => {
        return workerData as unknown as Response
      },
      factorial: (workerData?: Data) => {
        return {
          data: { number: factorial(workerData?.data?.number as number) }
        } as unknown as Response
      }
    })
  }
}

export const requestHandlerWorker = new RequestHandlerWorker<
WorkerData<DataPayload>,
WorkerResponse<DataPayload>
>()
