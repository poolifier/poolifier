const {
  DynamicThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const { runPoolifierTest } = require('../benchmark-utils')

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
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED }
)

async function dynamicThreadTest (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPool, { tasks, workerData })
}

async function dynamicThreadTestLessRecentlyUsed (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPoolLessRecentlyUsed, { tasks, workerData })
}

module.exports = {
  dynamicThreadTest,
  dynamicThreadTestLessRecentlyUsed
}
