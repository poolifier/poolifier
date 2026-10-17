import { parentPort, workerData } from 'node:worker_threads'

import { ThreadWorker } from '../../../lib/index.mjs'

let promiseExecutions = 0

export default new ThreadWorker(
  {
    closedFailure: async ({ port }) => {
      port.close()
      throw new Error('Expected task failure')
    },
    echo: data => {
      parentPort.postMessage({ started: true })
      return data
    },
    failure: async () => {
      throw new Error('Expected task failure')
    },
    hold: async ({ gate }) => {
      parentPort.postMessage({ started: true })
      await Atomics.waitAsync(new Int32Array(gate), 0, 0).value
      return 'released'
    },
    mutatedFailure: data => {
      data.workerMutation = true
      throw new Error('Expected task failure')
    },
    promiseEcho: data =>
      Promise.resolve({ data, executions: ++promiseExecutions }),
    promiseFailure: () => Promise.reject(new Error('Promise task failure')),
    promiseHold: ({ gate }) => {
      parentPort.postMessage({ started: true })
      return Promise.resolve(
        Atomics.waitAsync(new Int32Array(gate), 0, 0).value
      ).then(() => 'released')
    },
    syncFailure: () => {
      throw new Error('Expected task failure')
    },
  },
  {
    killHandler: async () => {
      await new Promise(resolve => setImmediate(resolve))
      if (workerData?.failCleanup === true) {
        throw new Error('Cleanup failure')
      }
    },
  }
)
