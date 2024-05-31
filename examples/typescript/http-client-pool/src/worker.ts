import axios from 'axios'
import nodeFetch, {
  type RequestInfo as NodeFetchRequestInfo,
  type ResponseInit as NodeFetchRequestInit,
} from 'node-fetch'
import { ThreadWorker } from 'poolifier'

import type { WorkerData, WorkerResponse } from './types.js'

class HttpClientWorker extends ThreadWorker<WorkerData, WorkerResponse> {
  public constructor () {
    super({
      node_fetch: async (workerData?: WorkerData) => {
        const response = await nodeFetch(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          workerData!.input as URL | NodeFetchRequestInfo,
          workerData?.init as NodeFetchRequestInit
        )
        // The response is not structured-cloneable, so we return the response text body instead.
        return {
          text: await response.text(),
        }
      },
      fetch: async (workerData?: WorkerData) => {
        const response = await fetch(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          workerData!.input as URL | RequestInfo,
          workerData?.init as RequestInit
        )
        // The response is not structured-cloneable, so we return the response text body instead.
        return {
          text: await response.text(),
        }
      },
      axios: async (workerData?: WorkerData) => {
        const response = await axios({
          method: 'get',
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          url: workerData!.input as string,
          ...workerData?.axiosRequestConfig,
        })
        return {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          text: response.data,
        }
      },
    })
  }
}

export const httpClientWorker = new HttpClientWorker()
