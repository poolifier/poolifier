const {
  FixedClusterPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')
const { runPoolifierTest } = require('../../benchmarks-utils')

const size = 30
const numberOfTasks = 1

const fixedPool = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js'
)

const fixedPoolTasksQueue = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js',
  { enableTasksQueue: true }
)

const fixedPoolLessUsed = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED }
)

const fixedPoolLessBusy = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_BUSY }
)

const fixedPoolWeightedRoundRobin = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN }
)

const fixedPoolFairShare = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE }
)

async function fixedClusterTest (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPool, { tasks, workerData })
}

async function fixedClusterTasksQueueTest (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPoolTasksQueue, { tasks, workerData })
}

async function fixedClusterTestLessUsed (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPoolLessUsed, { tasks, workerData })
}

async function fixedClusterTestLessBusy (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPoolLessBusy, { tasks, workerData })
}

async function fixedClusterTestWeightedRoundRobin (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPoolWeightedRoundRobin, { tasks, workerData })
}

async function fixedClusterTestFairShare (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPoolFairShare, { tasks, workerData })
}

module.exports = {
  fixedClusterTest,
  fixedClusterTasksQueueTest,
  fixedClusterTestLessUsed,
  fixedClusterTestLessBusy,
  fixedClusterTestWeightedRoundRobin,
  fixedClusterTestFairShare
}
