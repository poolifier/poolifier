import { ThreadWorker } from 'poolifier'
import {
  type BodyPayload,
  type WorkerData,
  type WorkerResponse
} from './types.js'

class RequestHandlerWorker<
  Data extends WorkerData<BodyPayload>,
  Response extends WorkerResponse<BodyPayload>
> extends ThreadWorker<Data, Response> {
  private static readonly factorial: (n: number) => number = n => {
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
          body: {
            number: RequestHandlerWorker.factorial(
              workerData?.body?.number as number
            )
          }
        } as unknown as Response
      }
    })
  }
}

export const requestHandlerWorker = new RequestHandlerWorker<
WorkerData<BodyPayload>,
WorkerResponse<BodyPayload>
>()
