import { parentPort, threadId } from 'node:worker_threads'

import { ThreadWorker } from '../../../lib/index.mjs'

const pendingTasks = new Map()

parentPort.on('message', message => {
  if (message.crash === true) {
    throw new Error('Worker crashed')
  }
  if (message.release != null) {
    pendingTasks.get(message.release)?.()
    pendingTasks.delete(message.release)
  }
})

export default new ThreadWorker(async data => {
  if (data.exitCode != null) {
    // Exit without an error event to exercise lost task responses.
    // eslint-disable-next-line n/no-process-exit
    process.exit(data.exitCode)
  }
  if (data.exitAfterResponse != null) {
    const status = new Int32Array(data.exitAfterResponse)
    setImmediate(() => {
      Atomics.store(status, 0, 1)
      Atomics.notify(status, 0)
      // eslint-disable-next-line n/no-process-exit
      process.exit(0)
    })
    if (data.fail === true) {
      throw new Error('Task failed before worker exit')
    }
    return data.response
  }
  if (data.wait === true) {
    return await new Promise(resolve => {
      pendingTasks.set(data.id, () => resolve(data))
      parentPort.postMessage({ started: data.id, workerId: threadId })
    })
  }
  return data
})
