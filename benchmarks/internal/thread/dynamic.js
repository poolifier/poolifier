const {
  DynamicThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const { runPoolifierTest } = require('../../benchmarks-utils')

const size = 30
const numberOfTasks = 1

const dynamicPool = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js'
)

const dynamicPoolLessUsed = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED }
)

const dynamicPoolLessBusy = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_BUSY }
)

const dynamicPoolWeightedRoundRobin = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
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

async function dynamicThreadTestLessUsed (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPoolLessUsed, { tasks, workerData })
}

async function dynamicThreadTestLessBusy (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPoolLessBusy, { tasks, workerData })
}

async function dynamicThreadTestWeightedRoundRobin (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPoolWeightedRoundRobin, { tasks, workerData })
}

async function dynamicThreadTestFairShare (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(dynamicPoolFairShare, { tasks, workerData })
}

module.exports = {
  dynamicThreadTest,
  dynamicThreadTestLessUsed,
  dynamicThreadTestLessBusy,
  dynamicThreadTestWeightedRoundRobin,
  dynamicThreadTestFairShare
}
