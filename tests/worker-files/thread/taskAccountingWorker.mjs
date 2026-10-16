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
  {
    killHandler: () => {
      // Preserve native SOFT retirement without racing a kill ACK against node removal.
      // eslint-disable-next-line n/no-process-exit
      process.exit(0)
    },
    maxInactiveTime: 100,
  }
)
