import { ThreadWorker } from 'poolifier'
import {
  type DataPayload,
  type ThreadWorkerData,
  type ThreadWorkerResponse
} from './types.js'

const factorial: (n: number) => number = n => {
  if (n === 0) {
    return 1
  }
  return factorial(n - 1) * n
}

class RequestHandlerWorker<
  Data extends ThreadWorkerData<DataPayload>,
  Response extends ThreadWorkerResponse<DataPayload>
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
ThreadWorkerData<DataPayload>,
ThreadWorkerResponse<DataPayload>
>()
