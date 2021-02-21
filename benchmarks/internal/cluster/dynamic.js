const { DynamicClusterPool } = require('../../../lib/index')

const size = 30

const dynamicPool = new DynamicClusterPool(
  size / 2,
  size * 3,
  './benchmarks/internal/cluster/worker.js',
  {
    maxTasks: 10000
  }
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

module.exports = { dynamicClusterTest }
