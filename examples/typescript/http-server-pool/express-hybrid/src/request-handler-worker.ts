import { ThreadWorker } from 'poolifier'
import {
  type DataPayload,
  type ThreadWorkerData,
  type ThreadWorkerResponse
} from './types.js'

class RequestHandlerWorker<
  Data extends ThreadWorkerData<DataPayload>,
  Response extends ThreadWorkerResponse<DataPayload>
> extends ThreadWorker<Data, Response> {
  private static readonly factorial = (n: number): number => {
    if (n === 0) {
      return 1
    }
    return RequestHandlerWorker.factorial(n - 1) * n
  }

  public constructor () {
    super({
      echo: (workerData?: Data) => {
        return workerData as unknown as Response
      },
      factorial: (workerData?: Data) => {
        return {
          data: {
            number: RequestHandlerWorker.factorial(
              workerData?.data?.number as number
            )
          }
        } as unknown as Response
      }
    })
  }
}

export const requestHandlerWorker = new RequestHandlerWorker<
ThreadWorkerData<DataPayload>,
ThreadWorkerResponse<DataPayload>
>()
