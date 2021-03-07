const {
  FixedClusterPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const { runPoolifierTest } = require('../benchmark-utils')

const size = 30
const numberOfTasks = 1

const fixedPool = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js'
)

const fixedPoolLessRecentlyUsed = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED }
)

async function fixedClusterTest (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPool, { tasks, workerData })
}

async function fixedClusterTestLessRecentlyUsed (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPoolLessRecentlyUsed, { tasks, workerData })
}

module.exports = { fixedClusterTest, fixedClusterTestLessRecentlyUsed }
