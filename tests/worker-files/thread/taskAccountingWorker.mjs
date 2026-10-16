import { parentPort } from 'node:worker_threads'

import { ThreadWorker } from '../../../lib/index.mjs'

export default new ThreadWorker(
  async ({ fail, gate, label }) => {
    parentPort.postMessage({ label })
    if (gate != null) {
      await Atomics.waitAsync(new Int32Array(gate), 0, 0).value
    }
    if (fail === true) {
      throw new Error(label)
    }
    return label
  },
  { maxInactiveTime: 100 }
)
