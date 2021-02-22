const { FixedThreadPool } = require('../../../lib/index')
const { runTest } = require('../benchmark-utils')

const size = 30

const fixedPool = new FixedThreadPool(
  size,
  './benchmarks/internal/thread/worker.js',
  {
    maxTasks: 10000
  }
)

async function fixedThreadTest (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runTest(fixedPool, { tasks, workerData })
}

module.exports = { fixedThreadTest }
