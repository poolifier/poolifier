import { ThreadWorker } from 'poolifier'

import type {
  DataPayload,
  ThreadWorkerData,
  ThreadWorkerResponse
} from './types.js'

class RequestHandlerWorker<
  Data extends ThreadWorkerData<DataPayload>,
  Response extends ThreadWorkerResponse<DataPayload>
> extends ThreadWorker<Data, Response> {
  private static readonly factorial = (n: number | bigint): bigint => {
    if (n === 0 || n === 1) {
      return 1n
    } else {
      n = BigInt(n)
      let factorial = 1n
      for (let i = 1n; i <= n; i++) {
        factorial *= i
      }
      return factorial
    }
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
              workerData!.data.number!
            ).toString()
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
