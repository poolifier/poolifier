import { ThreadWorker } from 'poolifier'
import {
  type BodyPayload,
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
  Data extends ThreadWorkerData<BodyPayload>,
  Response extends ThreadWorkerResponse<BodyPayload>
> extends ThreadWorker<Data, Response> {
  public constructor () {
    super({
      echo: (workerData?: Data) => {
        return workerData as unknown as Response
      },
      factorial: (workerData?: Data) => {
        return {
          body: { number: factorial(workerData?.body?.number as number) }
        } as unknown as Response
      }
    })
  }
}

export const requestHandlerWorker = new RequestHandlerWorker<
ThreadWorkerData<BodyPayload>,
ThreadWorkerResponse<BodyPayload>
>()
