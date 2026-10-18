import { parentPort, threadId, workerData } from 'node:worker_threads'

import { ThreadWorker } from '../../../lib/index.mjs'

const status = new Int32Array(workerData.bootstrapStatus)
const claimedRole = Atomics.add(status, 0, 1)
const role = workerData.bootstrapRole ?? claimedRole
const configuration = workerData.roles[role]
const blocked = role === workerData.blockedRole
parentPort.postMessage({ blocked, bootstrapRole: role, workerId: threadId })
if (blocked) Atomics.wait(status, 1, 0)

const pendingTasks = new Map()
parentPort.on('message', message => {
  if (message.exitCode != null) {
    // eslint-disable-next-line n/no-process-exit
    process.exit(message.exitCode)
  }
  if (message.release != null) {
    pendingTasks.get(message.release)?.()
    pendingTasks.delete(message.release)
  }
})

const run = async (data, taskFunction) => {
  if (data.wait === true) {
    await new Promise(resolve => {
      pendingTasks.set(data.id, resolve)
      parentPort.postMessage({ started: data.id, workerId: threadId })
    })
  }
  return { ...data, taskFunction, workerId: threadId }
}
const echo = async data => await run(data, 'echo')
const pinned = {
  taskFunction: async data => await run(data, 'pinned'),
  ...(configuration.strategy != null && {
    strategy: configuration.strategy,
  }),
  ...(configuration.workerNodeKeys != null && {
    workerNodeKeys: configuration.workerNodeKeys,
  }),
}

export default new ThreadWorker(
  configuration.defaultPinned
    ? Object.fromEntries([
      ['pinned', pinned],
      ['echo', echo],
    ])
    : { echo, pinned }
)
