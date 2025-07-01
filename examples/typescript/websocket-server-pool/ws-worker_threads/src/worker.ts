import { ThreadWorker } from 'poolifier'

import type { DataPayload, WorkerData, WorkerResponse } from './types.js'

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
          data: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            number: RequestHandlerWorker.factorial(workerData!.data.number!),
          },
        } as unknown as Response
      },
    })
  }

  private static readonly factorial = (n: bigint | number): bigint => {
    if (n === 0 || n === 1) {
      return 1n
    }
    n = BigInt(n)
    let factorial = 1n
    for (let i = 1n; i <= n; i++) {
      factorial *= i
    }
    return factorial
  }
}

export const requestHandlerWorker = new RequestHandlerWorker<
  WorkerData<DataPayload>,
  WorkerResponse<DataPayload>
>()
