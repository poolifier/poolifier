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
  private static readonly factorial: (n: number | bigint) => bigint = n => {
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
          body: {
            number: RequestHandlerWorker.factorial(
              workerData!.body.number!
            ).toString()
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
