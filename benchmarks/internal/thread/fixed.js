const { FixedThreadPool } = require('../../../lib/index')
const { runPoolifierTest } = require('../benchmark-utils')

const size = 30

const fixedPool = new FixedThreadPool(
  size,
  './benchmarks/internal/thread/worker.js'
)

async function fixedThreadTest (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPool, { tasks, workerData })
}

module.exports = { fixedThreadTest }
