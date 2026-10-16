import cluster from 'node:cluster'

import { ClusterWorker } from '../../../lib/index.mjs'

const pendingTasks = new Map()

process.on('message', message => {
  if (message.disconnect === true) {
    // Keep the disconnected process alive until its owner terminates it.
    setInterval(() => {}, 1000)
    cluster.worker.disconnect()
  }
  if (message.crash === true) {
    throw new Error('Worker crashed')
  }
  if (message.exitCode != null) {
    // eslint-disable-next-line n/no-process-exit
    process.exit(message.exitCode)
  }
  if (message.release != null) {
    pendingTasks.get(message.release)?.()
    pendingTasks.delete(message.release)
  }
})

export default new ClusterWorker(async data => {
  if (data.exitCode != null) {
    // Exit without an error event to exercise lost task responses.
    // eslint-disable-next-line n/no-process-exit
    process.exit(data.exitCode)
  }
  if (data.wait === true) {
    return await new Promise(resolve => {
      pendingTasks.set(data.id, () => resolve(data))
      process.send({ started: data.id, workerId: cluster.worker.id })
    })
  }
  return data
})
