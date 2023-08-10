import { ThreadWorker } from 'poolifier'
import fetch from 'node-fetch'
import { type WorkerData, type WorkerResponse } from './types.js'

class FetchWorker extends ThreadWorker<WorkerData, WorkerResponse> {
  public constructor () {
    super(async (workerData?: WorkerData) => {
      const response = await fetch(
        (workerData as WorkerData).url,
        workerData?.init
      )
      // The response is not structured-cloneable, so we return the response text body instead.
      return {
        text: await response.text()
      }
    })
  }
}

const fetchWorker = new FetchWorker()

export { fetchWorker }
