async function runPoolifierTest (pool, { tasks, workerData }) {
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

function generateRandomInteger (max, min = 0) {
  if (min) {
    return Math.floor(Math.random() * (max - min + 1) + min)
  }
  return Math.floor(Math.random() * max + 1)
}

module.exports = { runPoolifierTest, generateRandomInteger }
