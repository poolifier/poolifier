const {
  DynamicClusterPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const { runTest } = require('../benchmark-utils')

const size = 30

const dynamicPool = new DynamicClusterPool(
  size / 2,
  size * 3,
  './benchmarks/internal/cluster/worker.js',
  {
    maxTasks: 10000
  }
)

const dynamicPoolLessRecentlyUsed = new DynamicClusterPool(
  size / 2,
  size * 3,
  './benchmarks/internal/cluster/worker.js',
  {
    maxTasks: 10000
  },
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED }
)

const dynamicPoolRandom = new DynamicClusterPool(
  size / 2,
  size * 3,
  './benchmarks/internal/cluster/worker.js',
  {
    maxTasks: 10000
  },
  { workerChoiceStrategy: WorkerChoiceStrategies.RANDOM }
)

async function dynamicClusterTest (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runTest(dynamicPool, { tasks, workerData })
}

async function dynamicClusterTestLessRecentlyUsed (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runTest(dynamicPoolLessRecentlyUsed, { tasks, workerData })
}

async function dynamicClusterTestRandom (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runTest(dynamicPoolRandom, { tasks, workerData })
}

module.exports = {
  dynamicClusterTest,
  dynamicClusterTestLessRecentlyUsed,
  dynamicClusterTestRandom
}
