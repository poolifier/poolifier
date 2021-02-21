const { FixedThreadPool } = require('../../lib/index')

const size = 30

const fixedPool = new FixedThreadPool(size, './worker.js', {
  maxTasks: 10000
})

async function fixedThreadTest (
  { tasks, workerData } = { tasks: 1, workerData: { proof: 'ok' } }
) {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 0; i <= tasks; i++) {
      fixedPool
        .execute(workerData)
        .then(res => {
          executions++
          if (executions === tasks) {
            return resolve('FINISH')
          }
          return null
        })
        .catch(err => {
          console.error(err)
        })
    }
  })
}

module.exports = { fixedThreadTest }
