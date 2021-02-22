const {
  DynamicThreadPool,
  WorkerChoiceStrategies
} = require('../../../lib/index')

const size = 30

const dynamicPool = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js',
  {
    maxTasks: 10000
  }
)

const dynamicPoolLessRecentlyUsed = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js',
  {
    maxTasks: 10000
  },
  { workerChoiceStrategy: DynamicThreadPool.LESS_RECENTLY_USED }
)

const dynamicPoolRandom = new DynamicThreadPool(
  size / 2,
  size * 3,
  './benchmarks/internal/thread/worker.js',
  {
    maxTasks: 10000
  },
  { workerChoiceStrategy: WorkerChoiceStrategies.RANDOM }
)

async function dynamicThreadTest (
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

async function dynamicThreadTestLessRecentlyUsed (
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

async function dynamicThreadTestRandom (
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
  dynamicThreadTest,
  dynamicThreadTestLessRecentlyUsed,
  dynamicThreadTestRandom
}
