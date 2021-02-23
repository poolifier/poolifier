const {
  DynamicThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const { runTest } = require('../benchmark-utils')

const size = 30

const dynamicPool = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js'
)

const dynamicPoolLessRecentlyUsed = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js',
  { workerChoiceStrategy: DynamicThreadPool.LESS_RECENTLY_USED }
)

async function dynamicThreadTest (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runTest(dynamicPool, { tasks, workerData })
}

async function dynamicThreadTestLessRecentlyUsed (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runTest(dynamicPoolLessRecentlyUsed, { tasks, workerData })
}

module.exports = {
  dynamicThreadTest,
  dynamicThreadTestLessRecentlyUsed
}
