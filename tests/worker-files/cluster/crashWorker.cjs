'use strict'
const cluster = require('node:cluster')

const { ClusterWorker } = require('../../../lib/index.cjs')

const pendingTasks = new Map()

process.on('message', message => {
  if (message.crash === true) {
    throw new Error('Worker crashed')
  }
  if (message.release != null) {
    pendingTasks.get(message.release)?.()
    pendingTasks.delete(message.release)
  }
})

module.exports = new ClusterWorker(async data => {
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
