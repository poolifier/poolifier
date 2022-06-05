const {
  DynamicClusterPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const { runPoolifierTest } = require('../benchmark-utils')

const size = 30
const numberOfTasks = 1

const dynamicPool = new DynamicClusterPool(
  size / 2,
  size * 3,
  './benchmarks/internal/cluster/worker.js'
)

const dynamicPoolLessRecentlyUsed = new DynamicClusterPool(
  size / 2,
  size * 3,
  './benchmarks/internal/cluster/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED }
)

const dynamicPoolFairShare = new DynamicClusterPool(
  size / 2,
  size * 3,
  './benchmarks/internal/cluster/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
)

async function dynamicClusterTest (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPool, { tasks, workerData })
}

async function dynamicClusterTestLessRecentlyUsed (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPoolLessRecentlyUsed, { tasks, workerData })
}

async function dynamicClusterTestFairShare (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPoolFairShare, { tasks, workerData })
}

module.exports = {
  dynamicClusterTest,
  dynamicClusterTestFairShare,
  dynamicClusterTestLessRecentlyUsed
}
