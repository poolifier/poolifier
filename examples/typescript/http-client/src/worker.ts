import { ThreadWorker } from 'poolifier'
import nodeFetch from 'node-fetch'
import {
  type RequestInfo as NodeFetchRequestInfo,
  type ResponseInit as NodeFetchRequestInit
} from 'node-fetch'
import { type WorkerData, type WorkerResponse } from './types.js'

class HttpClientWorker extends ThreadWorker<WorkerData, WorkerResponse> {
  public constructor () {
    super({
      node_fetch: async (workerData?: WorkerData) => {
        const response = await nodeFetch(
          (workerData as WorkerData).url as URL | NodeFetchRequestInfo,
          workerData?.init as NodeFetchRequestInit
        )
        // The response is not structured-cloneable, so we return the response text body instead.
        return {
          text: await response.text()
        }
      },
      fetch: async (workerData?: WorkerData) => {
        const response = await fetch(
          (workerData as WorkerData).url as URL | RequestInfo,
          workerData?.init as RequestInit
        )
        // The response is not structured-cloneable, so we return the response text body instead.
        return {
          text: await response.text()
        }
      }
    })
  }
}

const httpClientWorker = new HttpClientWorker()

export { httpClientWorker }
