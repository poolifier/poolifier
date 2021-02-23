async function runTest (pool, { tasks, workerData }) {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 0; i <= tasks; i++) {
      pool
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

module.exports = { runTest }
