import { parentPort, threadId, workerData } from 'node:worker_threads'

import { ThreadWorker } from '../../../lib/index.mjs'

const waitForGate = async gate => {
  await Atomics.waitAsync(new Int32Array(gate), 0, 0).value
}

const run = async ({ gate, label }) => {
  parentPort.postMessage({ label, workerId: threadId })
  await waitForGate(gate)
  return { label, workerId: threadId }
}

// Entry order defines the default function; keep loader first independently of key sorting.
const taskFunctions = Object.fromEntries([
  ['loader', { taskFunction: run, workerNodeKeys: [0] }],
  ['anchor', { taskFunction: run, workerNodeKeys: [0, 2] }],
  ['survivor', { taskFunction: run, workerNodeKeys: [0, 3] }],
])

export default new ThreadWorker(taskFunctions, {
  killHandler: () => {
    parentPort.postMessage({ label: 'kill-handler', workerId: threadId })
    Atomics.wait(new Int32Array(workerData.killGate), 0, 0)
    // Exit from the public SOFT-kill hook without racing a kill ACK against node removal.
    // eslint-disable-next-line n/no-process-exit
    process.exit(0)
  },
  maxInactiveTime: 1000,
})
