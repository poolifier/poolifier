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

const fixedPoolLessRecentlyUsed = new FixedClusterPool(
  size,
  './benchmarks/internal/cluster/worker.js',
  { workerChoiceStrategy: WorkerChoiceStrategies.LESS_USED }
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

async function fixedClusterTestLessRecentlyUsed (
  { tasks, workerData } = { tasks: numberOfTasks, workerData: { proof: 'ok' } }
) {
  return runPoolifierTest(fixedPoolLessRecentlyUsed, { tasks, workerData })
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
  fixedClusterTestLessRecentlyUsed,
  fixedClusterTestWeightedRoundRobin,
  fixedClusterTestFairShare
}
