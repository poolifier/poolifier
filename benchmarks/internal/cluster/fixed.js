const { FixedClusterPool } = require('../../../lib/index')
const { runPoolifierTest } = require('../benchmark-utils')

const size = 30

const fixedPool = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js'
)

async function fixedClusterTest (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPool, { tasks, workerData })
}

module.exports = { fixedClusterTest }
