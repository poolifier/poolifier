const {
  DynamicThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const { runPoolifierTest } = require('../benchmark-utils')

const size = 30
const numberOfTasks = 1

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

const dynamicPoolFairShare = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
)

async function dynamicThreadTest (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPool, { tasks, workerData })
}

async function dynamicThreadTestLessRecentlyUsed (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPoolLessRecentlyUsed, { tasks, workerData })
}

async function dynamicThreadTestFairShare (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPoolFairShare, { tasks, workerData })
}

module.exports = {
  dynamicThreadTest,
  dynamicThreadTestFairShare,
  dynamicThreadTestLessRecentlyUsed
}
