const {
  DynamicClusterPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')

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
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 0; i <= tasks; i++) {
      dynamicPool
        .execute(workerData)
        .then(res => {
          executions++
          if (executions === tasks) {
            return resolve('FINISH')
          }
          return null
        })
        .catch(err => console.error(err))
    }
  })
}

async function dynamicClusterTestLessRecentlyUsed (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 0; i <= tasks; i++) {
      dynamicPoolLessRecentlyUsed
        .execute(workerData)
        .then(res => {
          executions++
          if (executions === tasks) {
            return resolve('FINISH')
          }
          return null
        })
        .catch(err => console.error(err))
    }
  })
}

async function dynamicClusterTestRandom (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 0; i <= tasks; i++) {
      dynamicPoolRandom
        .execute(workerData)
        .then(res => {
          executions++
          if (executions === tasks) {
            return resolve('FINISH')
          }
          return null
        })
        .catch(err => console.error(err))
    }
  })
}

module.exports = {
  dynamicClusterTest,
  dynamicClusterTestLessRecentlyUsed,
  dynamicClusterTestRandom
}
