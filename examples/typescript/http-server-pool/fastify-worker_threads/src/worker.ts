import { ThreadWorker } from 'poolifier'

import type { BodyPayload, WorkerData, WorkerResponse } from './types.js'

class RequestHandlerWorker<
  Data extends WorkerData<BodyPayload>,
  Response extends WorkerResponse<BodyPayload>
> extends ThreadWorker<Data, Response> {
  public constructor () {
    super({
      echo: (workerData?: Data) => {
        return workerData as unknown as Response
      },
      factorial: (workerData?: Data) => {
        return {
          body: {
            number: RequestHandlerWorker.factorial(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              workerData!.body.number!
            ).toString(),
          },
        } as unknown as Response
      },
    })
  }

  private static readonly factorial: (n: bigint | number) => bigint = n => {
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
}

export const requestHandlerWorker = new RequestHandlerWorker<
  WorkerData<BodyPayload>,
  WorkerResponse<BodyPayload>
>()
