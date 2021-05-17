const {
  FixedThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const { runPoolifierTest } = require('../benchmark-utils')

const size = 30
const numberOfTasks = 1

const fixedPool = new FixedThreadPool(
  size,
  './benchmarks/internal/thread/worker.js'
)

const fixedPoolLessRecentlyUsed = new FixedThreadPool(
  size,
  './benchmarks/internal/thread/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_RECENTLY_USED }
)

async function fixedThreadTest (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPool, { tasks, workerData })
}

async function fixedThreadTestLessRecentlyUsed (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPoolLessRecentlyUsed, { tasks, workerData })
}

module.exports = { fixedThreadTest, fixedThreadTestLessRecentlyUsed }
